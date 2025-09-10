import { initSidebar } from "./sidebar.js"

// Admin API implementation directly in this file
class AdminAPI {
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

    const response = await fetch(`${this.baseUrl}${endpoint}`, options);
    
    if (response.status === 401) {
      localStorage.removeItem('dfss_token');
      localStorage.removeItem('dfss_user');
      window.location.href = '/frontend/login/index.html';
      return null;
    }

    return response;
  }

  logout() {
    localStorage.removeItem('dfss_token');
    localStorage.removeItem('dfss_user');
    window.location.href = '/frontend/login/index.html';
  }

  async getAllFiles() {
    const response = await this.request('/files?all=true');
    if (!response) return { success: false };
    return { success: response.ok, data: await response.json() };
  }
  
  async getFiles(allFiles = false) {
    const endpoint = allFiles ? '/files?all=true' : '/files';
    const response = await this.request(endpoint);
    if (!response) return { success: false };
    return { success: response.ok, data: await response.json() };
  }

  async getSystemInfo() {
    const response = await this.request('/admin/system/info');
    if (!response) return { success: false };
    return { success: response.ok, data: await response.json() };
  }

  async getSystemNodes() {
    const response = await this.request('/admin/system/nodes');
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
const api = new AdminAPI();

// Dashboard functionality
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

  // Load dashboard data
  loadSystemStats()
  loadNodeStatus()
  loadRecentFiles()

  // Setup event listeners
  document.getElementById("logoutBtn").addEventListener("click", () => api.logout())
  document.getElementById("refreshNodes").addEventListener("click", loadNodeStatus)
})

// Load system statistics
async function loadSystemStats() {
  try {
    const { success, data } = await api.getSystemInfo()

    if (success && data) {
      document.getElementById("totalUsers").textContent = data.user_count || 0
      document.getElementById("totalFiles").textContent = data.file_count || 0
      document.getElementById("activeNodes").textContent = data.node_count || 0

      // Format storage size
      const sizeInMB = (data.total_size_bytes / (1024 * 1024)).toFixed(2)
      document.getElementById("storageUsed").textContent = `${sizeInMB} MB`
    } else {
      showError("Failed to load system statistics")
    }
  } catch (error) {
    console.error("Error loading system statistics:", error)
    showError("Error loading system statistics")
  }
}

// Update the loadNodeStatus function to use the actual API
async function loadNodeStatus() {
  const nodeStatusContainer = document.getElementById("nodeStatusContainer")
  nodeStatusContainer.innerHTML = `
    <div class="loading-spinner">
      <i class="fas fa-spinner fa-spin"></i>
    </div>
  `

  try {
    const { success, data } = await api.getSystemNodes()

    if (success && data && data.length > 0) {
      let nodesHtml = ""

      data.forEach((node) => {
        // Calculate usage percentage
        const usagePercent = calculateStoragePercent(node.size_bytes)
        let statusClass = "status-healthy"
        let statusText = "Healthy"

        // Check if node is failed
        if (node.status === "failed") {
          statusClass = "status-error"
          statusText = "Failed"
        } else if (node.status === "unknown") {
          statusClass = "status-warning"
          statusText = "Unknown"
        } else if (usagePercent > 95) {
          statusClass = "status-error"
        } else if (usagePercent > 80) {
          statusClass = "status-warning"
        }

        // Format size in MB
        const sizeMB = (node.size_bytes / (1024 * 1024)).toFixed(2)

        nodesHtml += `
          <div class="node-card">
            <div class="node-header">
              <div class="node-title">
                <i class="fas fa-server"></i> Node ${node.node_id}
              </div>
              <div class="node-status ${statusClass}">
                ${statusText}
              </div>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${usagePercent}%"></div>
            </div>
            <div class="node-stats">
              <div class="node-stat">
                <div class="node-stat-value">${node.files_count}</div>
                <div class="node-stat-label">Files</div>
              </div>
              <div class="node-stat">
                <div class="node-stat-value">${sizeMB} MB</div>
                <div class="node-stat-label">Used</div>
              </div>
              <div class="node-stat">
                <div class="node-stat-value">${usagePercent}%</div>
                <div class="node-stat-label">Usage</div>
              </div>
            </div>
          </div>
        `
      })

      nodeStatusContainer.innerHTML = nodesHtml
    } else {
      nodeStatusContainer.innerHTML = `
        <div class="text-center">Failed to load node status</div>
      `
    }
  } catch (error) {
    console.error("Error loading node status:", error)
    nodeStatusContainer.innerHTML = `
      <div class="text-center">Error loading node status</div>
    `
  }
}

// Update the loadRecentFiles function to use the actual API
async function loadRecentFiles() {
  const recentFilesTable = document.getElementById("recentFilesTable")

  try {
    const { success, data } = await api.getFiles(true)

    if (success && data && data.length > 0) {
      let filesHtml = ""

      // Show only the 5 most recent files
      const recentFiles = data.slice(0, 5)

      recentFiles.forEach((file) => {
        // Format file size
        const fileSize = formatFileSize(file.size)

        // Format date
        const uploadDate = new Date(file.upload_date).toLocaleString()

        filesHtml += `
          <tr>
            <td>${file.original_filename}</td>
            <td>${file.username}</td>
            <td>${fileSize}</td>
            <td>${uploadDate}</td>
            <td>
              <div class="action-buttons">
                <a href="${api.getDownloadUrl(file.id)}" class="btn-action btn-download">
                  <i class="fas fa-download"></i> Download
                </a>
                <button class="btn-action btn-delete" onclick="deleteFile(${file.id})">
                  <i class="fas fa-trash"></i> Delete
                </button>
              </div>
            </td>
          </tr>
        `
      })

      recentFilesTable.innerHTML = filesHtml
    } else {
      recentFilesTable.innerHTML = `
        <tr>
          <td colspan="5" class="text-center">No files found</td>
        </tr>
      `
    }
  } catch (error) {
    console.error("Error loading recent files:", error)
    recentFilesTable.innerHTML = `
      <tr>
        <td colspan="5" class="text-center">Error loading files</td>
      </tr>
    `
  }
}

// Update the deleteFile function to use the actual API
async function deleteFile(fileId) {
  if (!confirm("Are you sure you want to delete this file?")) {
    return
  }

  try {
    const { success, data } = await api.deleteFile(fileId)

    if (success) {
      // Reload files after deletion
      loadRecentFiles()
      loadSystemStats()
    } else {
      alert("Failed to delete file: " + (data.message || "Unknown error"))
    }
  } catch (error) {
    console.error("Error deleting file:", error)
    alert("Error deleting file")
  }
}

// Helper Functions
function calculateStoragePercent(bytes) {
  // For demo purposes, assume each node has 100MB capacity
  const nodeCapacity = 100 * 1024 * 1024 // 100MB in bytes
  return Math.min(Math.round((bytes / nodeCapacity) * 100), 100)
}

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

function showError(message) {
  console.error(message)
  // You could implement a toast notification system here
}

window.deleteFile = deleteFile;
