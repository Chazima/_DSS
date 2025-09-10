import os
import random
import shutil
from config import NODES_DIR, NODE_COUNT, REPLICATION_FACTOR

def store_file_with_replication(file_path, filename, user_id):
    """
    Store a file with replication across multiple nodes
    
    Args:
        file_path: Path to the file to be stored
        filename: Original filename for reference
        user_id: ID of the user who owns the file
        
    Returns:
        List of dictionaries containing file storage info
    """
    file_size = os.path.getsize(file_path)
    storage_info = []
    
    # Select random nodes for replication
    selected_nodes = random.sample(range(1, NODE_COUNT + 1), min(REPLICATION_FACTOR, NODE_COUNT))
    
    # Store the file on each selected node
    for node_id in selected_nodes:
        node_filename = f"user_{user_id}_{filename}"
        node_path = os.path.join(NODES_DIR, f"node{node_id}", node_filename)
        
        # Copy file to the node's directory
        shutil.copy2(file_path, node_path)
        
        # Store file location info
        storage_info.append({
            'node_id': node_id,
            'file_path': node_path,
            'size': file_size
        })
    
    return storage_info

def retrieve_file(file_locations, output_path):
    """
    Retrieve a file from any available node
    
    Args:
        file_locations: List of file location information from database
        output_path: Path to write the retrieved file to
        
    Returns:
        Path to the retrieved file
    """
    # Try each replica until one works
    for location in file_locations:
        try:
            # Check if the file exists on this node
            if os.path.exists(location['file_path']):
                shutil.copy2(location['file_path'], output_path)
                return output_path
        except Exception as e:
            continue
    
    # If we get here, no replica was available
    raise Exception("Could not retrieve file from any node")

def simulate_node_failure(node_id):
    """
    Simulate failure of a node by temporarily renaming its directory
    
    Args:
        node_id: ID of the node to simulate failure for
        
    Returns:
        Path to the failed node directory
    """
    node_path = os.path.join(NODES_DIR, f"node{node_id}")
    failed_node_path = os.path.join(NODES_DIR, f"node{node_id}_failed")
    
    # Delete failed path if it already exists
    if os.path.exists(failed_node_path):
        shutil.rmtree(failed_node_path)
        
    if os.path.exists(node_path):
        os.rename(node_path, failed_node_path)
    else:
        # Create the failed directory to mark it as failed
        os.makedirs(failed_node_path, exist_ok=True)
    
    return failed_node_path

def restore_node(node_id):
    """
    Restore a previously 'failed' node
    
    Args:
        node_id: ID of the node to restore
        
    Returns:
        Path to the restored node directory
    """
    node_path = os.path.join(NODES_DIR, f"node{node_id}")
    failed_node_path = os.path.join(NODES_DIR, f"node{node_id}_failed")
    
    # Make sure the destination doesn't exist
    if os.path.exists(node_path):
        shutil.rmtree(node_path)
        
    if os.path.exists(failed_node_path):
        os.rename(failed_node_path, node_path)
    else:
        # Create the node directory if neither exists
        os.makedirs(node_path, exist_ok=True)
    
    return node_path

def repair_node(node_id, database_path):
    """
    Repair a node by recreating missing files from replicas on other nodes
    
    Args:
        node_id: ID of the node to repair
        database_path: Path to the SQLite database
        
    Returns:
        int: Number of files repaired
    """
    import sqlite3
    
    node_path = os.path.join(NODES_DIR, f"node{node_id}")
    if not os.path.exists(node_path):
        os.makedirs(node_path)
    
    # Connect to database
    conn = sqlite3.connect(database_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get all files supposed to be on this node
    cursor.execute("""
        SELECT f.*, l.file_path
        FROM file_locations l
        JOIN files f ON l.file_id = f.id
        WHERE l.node_id = ?
    """, (node_id,))
    
    files_to_repair = cursor.fetchall()
    repaired_count = 0
    
    for file in files_to_repair:
        file_path = file['file_path']
        
        # If file already exists, skip
        if os.path.exists(file_path):
            continue
        
        # Find a replica of this file on another node
        cursor.execute("""
            SELECT file_path
            FROM file_locations
            WHERE file_id = ? AND node_id != ?
        """, (file['id'], node_id))
        
        replicas = cursor.fetchall()
        
        # Try to copy from each replica until success
        for replica in replicas:
            source_path = replica['file_path']
            if os.path.exists(source_path):
                try:
                    shutil.copy2(source_path, file_path)
                    repaired_count += 1
                    break
                except:
                    continue
    
    conn.close()
    return repaired_count 