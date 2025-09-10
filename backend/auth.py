from flask import Blueprint, request, jsonify, current_app
import jwt
from functools import wraps
import datetime
import sqlite3
import bcrypt
from config import DATABASE_PATH,  ROLES, JWT_SECRET_KEY

auth_bp = Blueprint('auth', __name__)

def init_db():
    """Initialize the database if it doesn't exist"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    # Create users table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Create files table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        size INTEGER NOT NULL,
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )
    ''')
    
    # Create file_locations table (replacing chunks table)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS file_locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL,
        node_id INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        size INTEGER NOT NULL,
        FOREIGN KEY (file_id) REFERENCES files (id)
    )
    ''')
    
    # Create an admin user if not exists
    cursor.execute("SELECT * FROM users WHERE username = 'admin'")
    if not cursor.fetchone():
        hashed_password = bcrypt.hashpw('admin123'.encode('utf-8'), bcrypt.gensalt())
        cursor.execute(
            "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)",
            ('admin', 'admin@dfss.com', hashed_password.decode('utf-8'), 'admin')
        )
    
    conn.commit()
    conn.close()

# Initialize the database
init_db()

def get_jwt_identity():
    """Get the user ID from the token in the request"""
    # First check Authorization header
    auth_header = request.headers.get('Authorization')
    token = None
    
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
    else:
        # Check if token is in query parameters (for direct downloads)
        token = request.args.get('token')
        
    if not token:
        return None
        
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=['HS256'])
        return payload['user_id']
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def token_required(f):
    """Decorator for routes that require a valid token"""
    @wraps(f)
    def decorated(*args, **kwargs):
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'message': 'Authentication required!'}), 401
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    """Decorator for routes that require admin access"""
    @wraps(f)
    def decorated(*args, **kwargs):
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'message': 'Authentication required!'}), 401
        
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        conn.close()
        
        if not user or user[0] != 'admin':
            return jsonify({'message': 'Admin privileges required!'}), 403
            
        return f(*args, **kwargs)
    return decorated

def jwt_required(f):
    """Alias for token_required for clarity"""
    return token_required(f)

@auth_bp.route('/register', methods=['POST'])
@admin_required  # Only admins can register new users
def register():
    data = request.get_json()
    
    # Validate required fields
    required_fields = ['username', 'email', 'password', 'role']
    for field in required_fields:
        if field not in data:
            return jsonify({'message': f'Missing required field: {field}'}), 400
    
    # Validate role
    if data['role'] not in ROLES:
        return jsonify({'message': f'Invalid role. Must be one of: {", ".join(ROLES)}'}), 400
    
    # Hash the password
    hashed_password = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt())
    
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute(
            "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)",
            (data['username'], data['email'], hashed_password.decode('utf-8'), data['role'])
        )
        conn.commit()
        new_user_id = cursor.lastrowid
        
        return jsonify({
            'message': 'User registered successfully',
            'user_id': new_user_id
        }), 201
    except sqlite3.IntegrityError:
        return jsonify({'message': 'Username or email already exists'}), 409
    finally:
        conn.close()

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'message': 'Username and password required'}), 400
    
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row  # Enable column access by name
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM users WHERE username = ?", (data['username'],))
    user = cursor.fetchone()
    conn.close()
    
    if not user or not bcrypt.checkpw(data['password'].encode('utf-8'), user['password'].encode('utf-8')):
        return jsonify({'message': 'Invalid credentials'}), 401
    
    # Generate token
    token_payload = {
        'user_id': user['id'],
        'role': user['role'],
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    }
    
    token = jwt.encode(token_payload, JWT_SECRET_KEY, algorithm='HS256')
    
    return jsonify({
        'message': 'Login successful',
        'token': token,
        'user_id': user['id'],
        'username': user['username'],
        'role': user['role']
    })

@auth_bp.route('/users', methods=['GET'])
@admin_required
def get_users():
    """Get all users - admin only endpoint"""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, username, email, role, created_at FROM users")
    users = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    return jsonify(users)

@auth_bp.route('/users/<int:user_id>', methods=['GET'])
@admin_required
def get_user(user_id):
    """Get a specific user - admin only endpoint"""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, username, email, role, created_at FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    
    if not user:
        return jsonify({'message': 'User not found'}), 404
    
    return jsonify(dict(user))

@auth_bp.route('/users/<int:user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    """Delete a user - admin only endpoint"""
    if user_id == 1:  # Protect the default admin
        return jsonify({'message': 'Cannot delete the default admin'}), 400
    
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    # Check if user exists
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'message': 'User not found'}), 404
    
    # Delete the user
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'User deleted successfully'})

@auth_bp.route('/profile', methods=['GET'])
@token_required
def get_profile():
    """Get the current user's profile"""
    user_id = get_jwt_identity()
    
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, username, email, role, created_at FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    
    if not user:
        return jsonify({'message': 'User not found'}), 404
    
    return jsonify(dict(user))

@auth_bp.route('/profile', methods=['PUT'])
@token_required
def update_profile():
    """Update the current user's profile"""
    user_id = get_jwt_identity()
    data = request.get_json()
    
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    # Check if user exists
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'message': 'User not found'}), 404
    
    # Fields that can be updated
    valid_fields = ['email', 'password']
    update_data = {}
    
    for field in valid_fields:
        if field in data:
            if field == 'password':
                hashed_password = bcrypt.hashpw(data[field].encode('utf-8'), bcrypt.gensalt())
                update_data[field] = hashed_password.decode('utf-8')
            else:
                update_data[field] = data[field]
    
    if not update_data:
        return jsonify({'message': 'No valid fields to update'}), 400
    
    # Build the update query
    query = "UPDATE users SET "
    query += ", ".join([f"{field} = ?" for field in update_data.keys()])
    query += " WHERE id = ?"
    
    # Execute the update
    cursor.execute(query, list(update_data.values()) + [user_id])
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Profile updated successfully'})