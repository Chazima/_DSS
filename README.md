# Distributed File Storage System

A simple distributed file storage system that replicates files across multiple storage nodes for redundancy and fault tolerance. This is designed for educational purposes to demonstrate basic concepts of distributed systems.

## How it Works

1. **File Storage**: Files are replicated across multiple storage nodes (default: 2 nodes)
2. **Fault Tolerance**: Even if one node fails, files can still be retrieved from other nodes
3. **Node Repair**: Failed nodes can be repaired by copying missing files from healthy nodes
4. **User Management**: Simple user authentication with role-based access control
5. **Web API**: RESTful API for file uploads, downloads, and management

## System Components

- **Authentication**: User registration and login with JWT-based authentication
- **File Management**: Upload, download, list, and delete files
- **Storage Nodes**: Multiple simulated storage nodes for file replication
- **Node Management**: Simulate node failures and repairs to test fault tolerance
- **Admin Features**: System monitoring and user management

## API Endpoints

### Authentication
- `POST /login`: Authenticate user and get JWT token
- `POST /register`: Register a new user (admin only)

### File Operations
- `POST /upload`: Upload a file to the distributed storage
- `GET /files`: List all files for the current user
- `GET /files/<file_id>`: Get detailed information about a file
- `GET /download/<file_id>`: Download a file
- `DELETE /files/<file_id>`: Delete a file and all its replicas

### System Status
- `GET /storage`: Get storage usage for the current user
- `GET /status`: Get system status information

### Admin Operations
- `GET /admin/system`: Get overall system information
- `GET /admin/system/nodes`: Get information about all storage nodes
- `POST /admin/system/fail-node/<node_id>`: Simulate a node failure
- `POST /admin/system/repair-node/<node_id>`: Repair a failed node

## Setup and Running

1. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

2. Run the application:
   ```
   python app.py
   ```

The server will start on port 5001 (http://localhost:5001).

## Default Credentials

- Username: admin
- Password: admin123

## Configuration

Edit `config.py` to customize:
- Number of storage nodes
- Replication factor
- Maximum file size
- User storage limits 
