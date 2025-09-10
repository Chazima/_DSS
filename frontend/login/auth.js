// Login authentication with integrated API functionality

// Login API implementation directly in this file
class LoginAPI {
  constructor() {
    this.baseUrl = 'http://localhost:5001';
  }

  async login(username, password) {
    try {
      const response = await fetch(`${this.baseUrl}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      
      if (response.ok) {
        localStorage.setItem('dfss_token', data.token);
        localStorage.setItem('dfss_user', JSON.stringify({
          id: data.user_id,
          username: data.username,
          role: data.role
        }));
        return { success: true, data };
      } else {
        return { success: false, data };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        data: { message: 'Network error. Please check your connection.' } 
      };
    }
  }

  isLoggedIn() {
    const token = localStorage.getItem('dfss_token');
    const user = JSON.parse(localStorage.getItem('dfss_user') || '{}');
    return token && user.id;
  }

  getUserRole() {
    const user = JSON.parse(localStorage.getItem('dfss_user') || '{}');
    return user.role || null;
  }
}

// Create API instance
const api = new LoginAPI();

document.addEventListener('DOMContentLoaded', () => {
    checkAuthStatus();
    setupLoginForm();
});

function checkAuthStatus() {
    // If user is already logged in, redirect to appropriate dashboard
    if (api.isLoggedIn()) {
        redirectToDashboard(api.getUserRole());
    }
}

function setupLoginForm() {
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Hide previous errors
        loginError.style.display = 'none';
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        try {
            const result = await api.login(username, password);
            
            if (result.success) {
                redirectToDashboard(api.getUserRole());
            } else {
                // Show error message
                loginError.textContent = result.data.message || 'Login failed. Please try again.';
                loginError.style.display = 'block';
            }
        } catch (error) {
            console.error('Login error:', error);
            loginError.textContent = 'An error occurred. Please try again later.';
            loginError.style.display = 'block';
        }
    });
}

function redirectToDashboard(role) {
    // Redirect to appropriate dashboard based on user role
    if (role === 'admin') {
        window.location.href = '../Admin/pages/dashboard.html';
    } else {
        window.location.href = '../users/pages/dashboard.html';
    }
}