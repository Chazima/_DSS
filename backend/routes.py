from flask import Blueprint, request, jsonify, send_file
import os
import sqlite3
import uuid
import werkzeug
from auth import token_required, admin_required, get_jwt_identity
from file_utils import store_file_with_replication, retrieve_file, simulate_node_failure, restore_node, repair_node as repair_node_files
from config import DATABASE_PATH, MAX_FILE_SIZE, NODE_COUNT, NODES_DIR
import tempfile

file_bp = Blueprint('file', __name__)

@file_bp.route('/upload', methods=['POST'])
@token_required
def upload_file():
    """Upload a file to the distributed storage system"""
    user_id = get_jwt_identity()
    
    # Check if the post request has the file part
    if 'file' not in request.files:
        return jsonify({'message': 'No file part in the request'}), 400
    
    file = request.files['file']
    
    # If user does not select file, browser also submits an empty part without filename
    if file.filename == '':
        return jsonify({'message': 'No file selected'}), 400
    
    # Check file size
    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)  # Reset file pointer to beginning
    
    if file_size > MAX_FILE_SIZE:
        return jsonify({
            'message': f'File too large. Maximum size: {MAX_FILE_SIZE/1024/1024:.2f} MB'
        }), 400
    
    # Generate a unique filename
    orig_filename = werkzeug.utils.secure_filename(file.filename)
    unique_filename = f"{uuid.uuid4()}_{orig_filename}"
    
    # Save file temporarily
    temp_path = os.path.join(tempfile.gettempdir(), unique_filename)
    file.save(temp_path)
    
    try:
        # Store the file with replication
        storage_info = store_file_with_replication(temp_path, unique_filename, user_id)
        
        # Store file metadata in database
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        # Insert file record
        cursor.execute(
            "INSERT INTO files (filename, original_filename, user_id, size) VALUES (?, ?, ?, ?)",
            (unique_filename, orig_filename, user_id, file_size)
        )
        file_id = cursor.lastrowid
        
        # Insert file location records
        for location in storage_info:
            cursor.execute(
                "INSERT INTO file_locations (file_id, node_id, file_path, size) VALUES (?, ?, ?, ?)",
                (file_id, location['node_id'], location['file_path'], location['size'])
            )
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'message': 'File uploaded successfully',
            'file_id': file_id,
            'replicas': len(storage_info)
        }), 201
        
    except Exception as e:
        return jsonify({'message': f'Error uploading file: {str(e)}'}), 500
    finally:
        # Clean up temporary file
        if os.path.exists(temp_path):
            os.remove(temp_path)

@file_bp.route('/files', methods=['GET'])
@token_required
def get_files():
    """Get list of files for current user or all files for admin"""
    user_id = get_jwt_identity()
    
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Check if user is admin
    cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    is_admin = user and user['role'] == 'admin'
    
    # Get files based on role
    if is_admin and request.args.get('all') == 'true':
        cursor.execute("""
            SELECT f.*, u.username 
            FROM files f
            JOIN users u ON f.user_id = u.id
            ORDER BY f.upload_date DESC
        """)
    else:
        cursor.execute("""
            SELECT f.* 
            FROM files f
            WHERE f.user_id = ?
            ORDER BY f.upload_date DESC
        """, (user_id,))
    
    files = [dict(row) for row in cursor.fetchall()]
    
    # Get node info for each file
    for file in files:
        cursor.execute("""
            SELECT node_id
            FROM file_locations
            WHERE file_id = ?
        """, (file['id'],))
        file['nodes'] = [row['node_id'] for row in cursor.fetchall()]
    
    conn.close()
    
    return jsonify(files)

@file_bp.route('/files/<int:file_id>', methods=['GET'])
@token_required
def get_file_info(file_id):
    """Get detailed information about a specific file"""
    user_id = get_jwt_identity()
    
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Check if user is admin
    cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    is_admin = user and user['role'] == 'admin'
    
    # Get file info
    cursor.execute("""
        SELECT f.*, u.username 
        FROM files f
        JOIN users u ON f.user_id = u.id
        WHERE f.id = ?
    """, (file_id,))
    file = cursor.fetchone()
    
    if not file:
        conn.close()
        return jsonify({'message': 'File not found'}), 404
    
    # Check if user has permission to access this file
    if not is_admin and file['user_id'] != user_id:
        conn.close()
        return jsonify({'message': 'Access denied'}), 403
    
    # Get location info
    cursor.execute("""
        SELECT id, node_id, file_path, size
        FROM file_locations
        WHERE file_id = ?
    """, (file_id,))
    locations = [dict(row) for row in cursor.fetchall()]
    
    file_info = dict(file)
    file_info['locations'] = locations
    
    conn.close()
    
    return jsonify(file_info)

@file_bp.route('/download/<int:file_id>', methods=['GET'])
@token_required
def download_file(file_id):
    """Download a file by retrieving it from any available node"""
    user_id = get_jwt_identity()
    
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Check if user is admin
    cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    is_admin = user and user['role'] == 'admin'
    
    # Get file info
    cursor.execute("SELECT * FROM files WHERE id = ?", (file_id,))
    file = cursor.fetchone()
    
    if not file:
        conn.close()
        return jsonify({'message': 'File not found'}), 404
    
    # Check if user has permission to access this file
    if not is_admin and file['user_id'] != user_id:
        conn.close()
        return jsonify({'message': 'Access denied'}), 403
    
    # Get file locations
    cursor.execute("""
        SELECT node_id, file_path, size
        FROM file_locations
        WHERE file_id = ?
    """, (file_id,))
    locations = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    
    if not locations:
        return jsonify({'message': 'File has no storage locations'}), 404
    
    # Prepare temp file for download
    temp_dir = tempfile.gettempdir()
    output_path = os.path.join(temp_dir, file['original_filename'])
    
    try:
        # Retrieve the file from any available node
        retrieve_file(locations, output_path)
        
        return send_file(
            output_path,
            as_attachment=True,
            download_name=file['original_filename'],
            mimetype='application/octet-stream'
        )
    except Exception as e:
        return jsonify({'message': f'Error retrieving file: {str(e)}'}), 500

@file_bp.route('/files/<int:file_id>', methods=['DELETE'])
@token_required
def delete_file(file_id):
    """Delete a file and all its replicas"""
    user_id = get_jwt_identity()
    
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Check if user is admin
    cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    is_admin = user and user['role'] == 'admin'
    
    # Get file info
    cursor.execute("SELECT * FROM files WHERE id = ?", (file_id,))
    file = cursor.fetchone()
    
    if not file:
        conn.close()
        return jsonify({'message': 'File not found'}), 404
    
    # Check if user has permission to delete this file
    if not is_admin and file['user_id'] != user_id:
        conn.close()
        return jsonify({'message': 'Access denied'}), 403
    
    # Get file locations
    cursor.execute("SELECT file_path FROM file_locations WHERE file_id = ?", (file_id,))
    locations = cursor.fetchall()
    
    # Delete all file replicas from storage nodes
    for location in locations:
        file_path = location['file_path']
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except:
                pass  # Continue even if delete fails
    
    # Delete database records
    cursor.execute("DELETE FROM file_locations WHERE file_id = ?", (file_id,))
    cursor.execute("DELETE FROM files WHERE id = ?", (file_id,))
    
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'File deleted successfully'})

@file_bp.route('/users/<int:user_id>/files', methods=['GET'])
@admin_required
def get_user_files(user_id):
    """Admin endpoint to get all files for a specific user"""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Check if user exists
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    
    if not user:
        conn.close()
        return jsonify({'message': 'User not found'}), 404
    
    # Get all files for this user
    cursor.execute("""
        SELECT f.* 
        FROM files f
        WHERE f.user_id = ?
        ORDER BY f.upload_date DESC
    """, (user_id,))
    
    files = [dict(row) for row in cursor.fetchall()]
    
    # Get node info for each file
    for file in files:
        cursor.execute("""
            SELECT node_id
            FROM file_locations
            WHERE file_id = ?
        """, (file['id'],))
        file['nodes'] = [row['node_id'] for row in cursor.fetchall()]
    
    conn.close()
    
    return jsonify(files)

@file_bp.route('/admin/system/nodes', methods=['GET'])
@admin_required
def get_system_nodes():
    """Admin endpoint to get information about all storage nodes"""
    nodes_info = []
    
    for i in range(1, NODE_COUNT + 1):
        node_path = os.path.join(NODES_DIR, f"node{i}")
        
        # Check if node directory exists
        if not os.path.exists(node_path):
            # Look for failed node directory
            failed_node_path = os.path.join(NODES_DIR, f"node{i}_failed")
            if os.path.exists(failed_node_path):
                nodes_info.append({
                    "node_id": i,
                    "files_count": len([f for f in os.listdir(failed_node_path) if os.path.isfile(os.path.join(failed_node_path, f))]),
                    "size_bytes": sum(os.path.getsize(os.path.join(failed_node_path, f)) 
                                    for f in os.listdir(failed_node_path) if os.path.isfile(os.path.join(failed_node_path, f))),
                    "status": "failed"
                })
            else:
                # Node doesn't exist at all
                nodes_info.append({
                    "node_id": i,
                    "files_count": 0,
                    "size_bytes": 0,
                    "status": "unknown"
                })
            continue
        
        # Normal healthy node
        files_count = len([f for f in os.listdir(node_path) if os.path.isfile(os.path.join(node_path, f))])
        total_size = sum(os.path.getsize(os.path.join(node_path, f)) 
                        for f in os.listdir(node_path) if os.path.isfile(os.path.join(node_path, f)))
        
        nodes_info.append({
            "node_id": i,
            "files_count": files_count,
            "size_bytes": total_size,
            "status": "healthy"
        })
    
    return jsonify(nodes_info)

@file_bp.route('/admin/system/fail-node/<int:node_id>', methods=['POST'])
@admin_required
def fail_node(node_id):
    """Admin endpoint to simulate a node failure"""
    if node_id < 1 or node_id > NODE_COUNT:
        return jsonify({'message': f'Invalid node ID. Must be between 1 and {NODE_COUNT}'}), 400
    
    try:
        failed_path = simulate_node_failure(node_id)
        return jsonify({
            'message': f'Node {node_id} failure simulated successfully',
            'failed_path': failed_path
        })
    except Exception as e:
        return jsonify({'message': f'Error simulating node failure: {str(e)}'}), 500

@file_bp.route('/admin/system/repair-node/<int:node_id>', methods=['POST'])
@admin_required
def repair_node(node_id):
    """Admin endpoint to repair a failed node"""
    if node_id < 1 or node_id > NODE_COUNT:
        return jsonify({'message': f'Invalid node ID. Must be between 1 and {NODE_COUNT}'}), 400
    
    try:
        # First restore the node
        node_path = restore_node(node_id)
        
        # Then repair missing files
        files_repaired = repair_node_files(node_id, DATABASE_PATH)
        
        return jsonify({
            'message': f'Node {node_id} repaired successfully',
            'node_path': node_path,
            'files_repaired': files_repaired
        })
    except Exception as e:
        return jsonify({'message': f'Error repairing node: {str(e)}'}), 500

@file_bp.route('/admin/system/info', methods=['GET'])
@admin_required
def get_system_info():
    """Admin endpoint to get overall system information"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    # Get user count
    cursor.execute("SELECT COUNT(*) FROM users")
    user_count = cursor.fetchone()[0]
    
    # Get file count
    cursor.execute("SELECT COUNT(*) FROM files")
    file_count = cursor.fetchone()[0]
    
    # Get total storage size
    cursor.execute("SELECT SUM(size) FROM files")
    total_size = cursor.fetchone()[0] or 0
    
    # Get file distribution across nodes
    cursor.execute("""
        SELECT node_id, COUNT(*) as file_count
        FROM file_locations
        GROUP BY node_id
    """)
    node_distribution = {row[0]: row[1] for row in cursor.fetchall()}
    
    conn.close()
    
    return jsonify({
        'user_count': user_count,
        'file_count': file_count,
        'total_size_bytes': total_size,
        'node_count': NODE_COUNT,
        'node_distribution': node_distribution
    })