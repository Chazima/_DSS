from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import sqlite3
from auth import auth_bp, get_jwt_identity, jwt_required, token_required, admin_required
from routes import file_bp
import config

app = Flask(__name__)
app.config.from_object(config)
# Enable CORS for all routes
CORS(app, resources={r"/*": {"origins": "*"}})

# Register blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(file_bp)

# Create node directories if they don't exist
for i in range(1, config.NODE_COUNT + 1):
    node_path = os.path.join(config.NODES_DIR, f"node{i}")
    if not os.path.exists(node_path):
        os.makedirs(node_path)

@app.route('/')
def home():
    return jsonify({"message": "Distributed File Storage System API"})

@app.route('/storage')
@jwt_required
def user_storage():
    """Get storage information for the authenticated user"""
    user_id = get_jwt_identity()
    
    # Get user files from database
    try:
        conn = sqlite3.connect(config.DATABASE_PATH)
        cursor = conn.cursor()
        
        # Get file count for this user
        cursor.execute("SELECT COUNT(*) FROM files WHERE user_id = ?", (user_id,))
        files_count = cursor.fetchone()[0]
        
        # Get total size of files for this user
        cursor.execute("SELECT SUM(size) FROM files WHERE user_id = ?", (user_id,))
        total_size = cursor.fetchone()[0] or 0
        
        conn.close()
        
        # Get user's storage limit
        storage_limit_bytes = config.DEFAULT_STORAGE_LIMIT_BYTES
        
        return jsonify({
            "user_id": user_id,
            "files_count": files_count,
            "used_storage_bytes": total_size,
            "storage_limit_bytes": storage_limit_bytes
        })
    except Exception as e:
        return jsonify({"message": f"Error retrieving storage info: {str(e)}"}), 500

@app.route('/status')
@token_required
def get_status():
    """Get system status - accessible by all authenticated users"""
    user_id = get_jwt_identity()
    
    # Get basic system status with nodes
    nodes_info = []
    for i in range(1, config.NODE_COUNT + 1):
        node_path = os.path.join(config.NODES_DIR, f"node{i}")
        
        # Check node status
        if not os.path.exists(node_path):
            # Look for failed node directory
            failed_node_path = os.path.join(config.NODES_DIR, f"node{i}_failed")
            if os.path.exists(failed_node_path):
                nodes_info.append({
                    "node_id": i,
                    "status": "failed"
                })
            else:
                nodes_info.append({
                    "node_id": i,
                    "status": "unknown"
                })
        else:
            nodes_info.append({
                "node_id": i,
                "status": "healthy"
            })
    
    return jsonify({
        "status": "healthy",
        "nodes": nodes_info,
        "user_id": user_id
    })

@app.route('/admin/system')
@admin_required
def admin_system():
    """Admin-only endpoint for system information"""
    # Get database statistics
    conn = sqlite3.connect(config.DATABASE_PATH)
    cursor = conn.cursor()
    
    # Get total users
    cursor.execute("SELECT COUNT(*) FROM users")
    total_users = cursor.fetchone()[0]
    
    # Get total files
    cursor.execute("SELECT COUNT(*) FROM files")
    total_files = cursor.fetchone()[0]
    
    # Get total size
    cursor.execute("SELECT SUM(size) FROM files")
    total_size = cursor.fetchone()[0] or 0
    
    conn.close()
    
    return jsonify({
        "total_users": total_users,
        "total_files": total_files,
        "total_size_bytes": total_size,
        "node_count": config.NODE_COUNT
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001) 