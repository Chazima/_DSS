import os
import secrets

# Directory for the application
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# JWT Configuration
JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', secrets.token_hex(32))

# Database configuration
DATABASE_PATH = os.path.join(BASE_DIR, 'metadata.sqlite')

# Storage configurations
NODES_DIR = os.path.join(BASE_DIR, 'nodes')
NODE_COUNT = 3  # Number of storage nodes
REPLICATION_FACTOR = 2  # Each file is stored on this many different nodes
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB max file size
DEFAULT_STORAGE_LIMIT_BYTES = 100 * 1024 * 1024  # 100MB default storage limit per user

# User roles
ROLES = ['admin', 'user']

# Create necessary directories
if not os.path.exists(NODES_DIR):
    os.makedirs(NODES_DIR)

for i in range(1, NODE_COUNT + 1):
    node_path = os.path.join(NODES_DIR, f"node{i}")
    if not os.path.exists(node_path):
        os.makedirs(node_path)