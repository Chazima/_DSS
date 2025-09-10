// Admin Users Management API implementation
class UsersAdminAPI {
  constructor() {
    this.baseUrl = 'http://localhost:5001';
    this.token = localStorage.getItem('dfss_token');
  }

  async request(endpoint, method = 'GET', body = null) {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const options = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, options);
      
      if (response.status === 401) {
        localStorage.removeItem('dfss_token');
        localStorage.removeItem('dfss_user');
        window.location.href = '/frontend/login/index.html';
        return null;
      }

      return response;
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      return null;
    }
  }

  logout() {
    localStorage.removeItem('dfss_token');
    localStorage.removeItem('dfss_user');
    window.location.href = '/frontend/login/index.html';
  }

  async getUsers() {
    const response = await this.request('/users');
    if (!response) return { success: false };
    return { success: response.ok, data: await response.json() };
  }

  async getUserFiles(userId) {
    const response = await this.request(`/users/${userId}/files`);
    if (!response) return { success: false };
    return { success: response.ok, data: await response.json() };
  }

  async deleteUser(userId) {
    const response = await this.request(`/users/${userId}`, 'DELETE');
    if (!response) return { success: false };
    return { success: response.ok, data: await response.json() };
  }

  async addUser(userData) {
    const response = await this.request('/register', 'POST', userData);
    if (!response) return { success: false };
    return { success: response.ok, data: await response.json() };
  }

  async deleteFile(fileId) {
    const response = await this.request(`/files/${fileId}`, 'DELETE');
    if (!response) return { success: false };
    return { success: response.ok, data: await response.json() };
  }

  getDownloadUrl(fileId) {
    return `${this.baseUrl}/download/${fileId}?token=${this.token}`;
  }
}

// Create API instance
const api = new UsersAdminAPI();

document.addEventListener("DOMContentLoaded", () => {
    // Check if user is logged in and is admin
    const user = JSON.parse(localStorage.getItem("dfss_user") || "{}")
    if (!user.id || user.role !== "admin") {
      window.location.href = "/frontend/login/index.html"
      return
    }
  
    // Set username in header
    document.getElementById("username").textContent = user.username
  
    // Initialize sidebar toggle
    initSidebar()
  
    // Load users data
    loadUsers()
  
    // Setup event listeners
    document.getElementById("logoutBtn").addEventListener("click", () => api.logout())
    document.getElementById("addUserBtn").addEventListener("click", showAddUserModal)
    document.getElementById("closeAddUserModal").addEventListener("click", hideAddUserModal)
    document.getElementById("cancelAddUser").addEventListener("click", hideAddUserModal)
    document.getElementById("closeUserFilesModal").addEventListener("click", hideUserFilesModal)
    document.getElementById("addUserForm").addEventListener("submit", handleAddUser)
  
    // Close modals when clicking outside
    window.addEventListener("click", (e) => {
      const addUserModal = document.getElementById("addUserModal")
      const userFilesModal = document.getElementById("userFilesModal")
  
      if (e.target === addUserModal) {
        hideAddUserModal()
      }
  
      if (e.target === userFilesModal) {
        hideUserFilesModal()
      }
    })
  })
  
  function initSidebar() {
    const sidebarToggle = document.getElementById("sidebarToggle")
    const sidebar = document.querySelector(".sidebar")
  
    sidebarToggle.addEventListener("click", () => {
      sidebar.classList.toggle("active")
    })
  }
  
  async function loadUsers() {
    const usersTable = document.getElementById("usersTable")
  
    try {
      const { success, data } = await api.getUsers()
  
      if (success && data.length > 0) {
        let usersHtml = ""
  
        data.forEach((user) => {
          // Format date
          const createdDate = new Date(user.created_at).toLocaleDateString()
  
          // Role badge class
          const roleClass = user.role === "admin" ? "role-admin" : "role-user"
  
          usersHtml += `
                      <tr>
                          <td>${user.username}</td>
                          <td>${user.email}</td>
                          <td><span class="user-role ${roleClass}">${user.role}</span></td>
                          <td>${createdDate}</td>
                          <td>
                              <button class="btn-action btn-view" onclick="viewUserFiles(${user.id}, '${user.username}')">
                                  <i class="fas fa-folder-open"></i> View Files
                              </button>
                          </td>
                          <td>
                              <div class="action-buttons">
                                  ${
                                    user.id === 1
                                      ? `<button class="btn-action btn-delete" disabled title="Cannot delete default admin">
                                          <i class="fas fa-trash"></i> Delete
                                      </button>`
                                      : `<button class="btn-action btn-delete" onclick="deleteUser(${user.id})">
                                          <i class="fas fa-trash"></i> Delete
                                      </button>`
                                  }
                              </div>
                          </td>
                      </tr>
                  `
        })
  
        usersTable.innerHTML = usersHtml
      } else {
        usersTable.innerHTML = `
                  <tr>
                      <td colspan="6" class="text-center">No users found</td>
                  </tr>
              `
      }
    } catch (error) {
      console.error("Error loading users:", error)
      usersTable.innerHTML = `
              <tr>
                  <td colspan="6" class="text-center">Error loading users</td>
              </tr>
          `
    }
  }
  
  async function viewUserFiles(userId, username) {
    const modal = document.getElementById("userFilesModal")
    const modalTitle = document.getElementById("userFilesTitle")
    const userFilesTable = document.getElementById("userFilesTable")
  
    // Show modal with loading spinner
    modal.classList.add("active")
    modalTitle.textContent = username
    userFilesTable.innerHTML = `
          <tr>
              <td colspan="4" class="text-center">
                  <div class="loading-spinner">
                      <i class="fas fa-spinner fa-spin"></i>
                  </div>
              </td>
          </tr>
      `
  
    try {
      const { success, data } = await api.getUserFiles(userId)
  
      if (success && data.length > 0) {
        let filesHtml = ""
  
        data.forEach((file) => {
          // Format file size
          const fileSize = formatFileSize(file.size)
  
          // Format date
          const uploadDate = new Date(file.upload_date).toLocaleString()
  
          filesHtml += `
                      <tr>
                          <td>${file.original_filename}</td>
                          <td>${fileSize}</td>
                          <td>${uploadDate}</td>
                          <td>
                              <div class="action-buttons">
                                  <a href="${api.getDownloadUrl(file.id)}" class="btn-action btn-view">
                                      <i class="fas fa-download"></i> Download
                                  </a>
                                  <button class="btn-action btn-delete" onclick="deleteFileFromModal(${file.id})">
                                      <i class="fas fa-trash"></i> Delete
                                  </button>
                              </div>
                          </td>
                      </tr>
                  `
        })
  
        userFilesTable.innerHTML = filesHtml
      } else {
        userFilesTable.innerHTML = `
                  <tr>
                      <td colspan="4" class="text-center">No files found for this user</td>
                  </tr>
              `
      }
    } catch (error) {
      console.error("Error loading user files:", error)
      userFilesTable.innerHTML = `
              <tr>
                  <td colspan="4" class="text-center">Error loading files</td>
              </tr>
          `
    }
  }
  
  async function deleteUser(userId) {
    if (!confirm("Are you sure you want to delete this user? All their files will remain in the system.")) {
      return
    }
  
    try {
      const { success, data } = await api.deleteUser(userId)
  
      if (success) {
        // Reload users after deletion
        loadUsers()
      } else {
        alert("Failed to delete user: " + (data.message || "Unknown error"))
      }
    } catch (error) {
      console.error("Error deleting user:", error)
      alert("Error deleting user")
    }
  }
  
  async function deleteFileFromModal(fileId) {
    if (!confirm("Are you sure you want to delete this file?")) {
      return
    }
  
    try {
      const { success, data } = await api.deleteFile(fileId)
  
      if (success) {
        // Refresh the files list in the modal
        const userFilesTitle = document.getElementById("userFilesTitle").textContent
        const userId = await getUserIdByUsername(userFilesTitle)
        if (userId) {
          viewUserFiles(userId, userFilesTitle)
        } else {
          hideUserFilesModal()
        }
      } else {
        alert("Failed to delete file: " + (data.message || "Unknown error"))
      }
    } catch (error) {
      console.error("Error deleting file:", error)
      alert("Error deleting file")
    }
  }
  
  async function getUserIdByUsername(username) {
    try {
      const { success, data } = await api.getUsers()
  
      if (success) {
        const user = data.find((u) => u.username === username)
        return user ? user.id : null
      }
      return null
    } catch (error) {
      console.error("Error finding user:", error)
      return null
    }
  }
  
  function showAddUserModal() {
    document.getElementById("addUserModal").classList.add("active")
    document.getElementById("addUserForm").reset()
  }
  
  function hideAddUserModal() {
    document.getElementById("addUserModal").classList.remove("active")
  }
  
  function hideUserFilesModal() {
    document.getElementById("userFilesModal").classList.remove("active")
  }
  
  async function handleAddUser(e) {
    e.preventDefault()
  
    const username = document.getElementById("newUsername").value
    const email = document.getElementById("newEmail").value
    const password = document.getElementById("newPassword").value
    const role = document.getElementById("newRole").value
  
    try {
      const { success, data } = await api.addUser({ username, email, password, role })
  
      if (success) {
        hideAddUserModal()
        loadUsers()
      } else {
        alert("Failed to add user: " + (data.message || "Unknown error"))
      }
    } catch (error) {
      console.error("Error adding user:", error)
      alert("Error adding user")
    }
  }
  
  // Helper Functions
  function formatFileSize(bytes) {
    if (bytes < 1024) {
      return bytes + " B"
    } else if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(2) + " KB"
    } else if (bytes < 1024 * 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(2) + " MB"
    } else {
      return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB"
    }
  }
  
window.viewUserFiles = viewUserFiles;
window.deleteUser = deleteUser;
window.deleteFileFromModal = deleteFileFromModal;
  