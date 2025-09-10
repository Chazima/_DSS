// Admin Files Management with integrated API functionality

// Admin API implementation for files management
class FilesAdminAPI {
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
      showBackendUnavailableError();
      return null;
    }
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

  async getFileInfo(fileId) {
    const response = await this.request(`/files/${fileId}`);
    if (!response) return { success: false };
    return { success: response.ok, data: await response.json() };
  }

  async deleteFile(fileId) {
    const response = await this.request(`/files/${fileId}`, 'DELETE');
    if (!response) return { success: false };
    return { success: response.ok, data: await response.json() };
  }

  async getSystemNodes() {
    const response = await this.request('/admin/system/nodes');
    if (!response) return { success: false };
    
    try {
      const data = await response.json();
      // Wrapper for API consistency
      return { success: response.ok, data: { nodes: data } };
    } catch (error) {
      console.error("Error parsing JSON response:", error);
      return { success: false, error: "Invalid response format" };
    }
  }

  getDownloadUrl(fileId) {
    return `${this.baseUrl}/download/${fileId}?token=${this.token}`;
  }
}

// Create API instance
const api = new FilesAdminAPI();

// Store node statuses globally for UI display
const nodeStatuses = {};

// Initialize sidebar toggle functionality
function initSidebar() {
  const sidebarToggle = document.getElementById("sidebarToggle");
  const sidebar = document.querySelector(".sidebar");

  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener("click", () => {
      sidebar.classList.toggle("active");
    });
  }
}

// Function to show backend server unavailable error
function showBackendUnavailableError() {
  // Check if the error message already exists
  if (!document.getElementById("backend-error")) {
    const errorDiv = document.createElement("div");
    errorDiv.id = "backend-error";
    errorDiv.className = "backend-error";
    errorDiv.innerHTML = `
      <div class="backend-error-content">
        <i class="fas fa-exclamation-triangle"></i>
        <h3>Backend Server Unavailable</h3>
        <p>The application cannot connect to the backend server at ${api.baseUrl}.</p>
        <p>Please make sure:</p>
        <ul>
          <li>The server is running on port 5001</li>
          <li>There are no network connectivity issues</li>
          <li>CORS is properly configured on the server</li>
        </ul>
        <button id="dismiss-error" class="btn-error-dismiss">Dismiss</button>
      </div>
    `;
    
    document.body.appendChild(errorDiv);
    
    // Add styles for the error message
    const style = document.createElement("style");
    style.innerHTML = `
      .backend-error {
        position: fixed;
        top: 20px;
        right: 20px;
        max-width: 400px;
        background-color: #f44336;
        color: white;
        padding: 15px;
        border-radius: 5px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 9999;
      }
      .backend-error-content {
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .backend-error i {
        font-size: 32px;
        margin-bottom: 10px;
      }
      .backend-error h3 {
        margin: 0 0 10px 0;
      }
      .backend-error p {
        margin: 5px 0;
        text-align: center;
      }
      .backend-error ul {
        margin: 5px 0;
        padding-left: 20px;
      }
      .backend-error li {
        margin: 3px 0;
      }
      .btn-error-dismiss {
        margin-top: 10px;
        padding: 5px 15px;
        background-color: rgba(255,255,255,0.3);
        border: none;
        border-radius: 3px;
        color: white;
        cursor: pointer;
      }
      .btn-error-dismiss:hover {
        background-color: rgba(255,255,255,0.5);
      }
    `;
    document.head.appendChild(style);
    
    // Add dismiss functionality
    document.getElementById("dismiss-error").addEventListener("click", () => {
      errorDiv.remove();
    });
  }
}

// Check backend server availability on page load
async function checkBackendAvailability() {
  try {
    const response = await fetch(`${api.baseUrl}/`);
    if (response.ok) {
      console.log("Backend server is available");
    } else {
      console.warn("Backend server returned an error status");
      showBackendUnavailableError();
    }
  } catch (error) {
    console.error("Backend server is unavailable:", error);
    showBackendUnavailableError();
  }
}

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
  
  // Check backend availability
  checkBackendAvailability()

  // Load files data
  loadFiles()

  // Setup event listeners
  document.getElementById("logoutBtn").addEventListener("click", () => api.logout())
  document.getElementById("searchBtn").addEventListener("click", handleSearch)
  document.getElementById("fileSearch").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  })

  // Modal close button
  document.getElementById("closeFileDetailsModal").addEventListener("click", () => {
    document.getElementById("fileDetailsModal").classList.remove("active")
  })

  // Close modal when clicking outside
  window.addEventListener("click", (e) => {
    const modal = document.getElementById("fileDetailsModal")
    if (e.target === modal) {
      modal.classList.remove("active")
    }
  })
})

// Fetch node statuses for UI
async function fetchNodeStatuses() {
  try {
    const response = await api.getSystemNodes();
    if (response.success && response.data && response.data.nodes) {
      // If the nodes property exists and is an array, process it
      response.data.nodes.forEach(node => {
        nodeStatuses[node.node_id] = node.status;
      });
    } else {
      console.warn("No node status data received from API");
      // Set a default status for UI rendering when API fails
      nodeStatuses[1] = 'healthy';  // Assume at least node 1 exists and is healthy
    }
  } catch (error) {
    console.error("Error fetching node statuses:", error);
    // Set a default status for UI rendering when API fails
    nodeStatuses[1] = 'healthy';  // Assume at least node 1 exists and is healthy
  }
}

// Global variables for pagination
let currentPage = 1
const filesPerPage = 10
let allFiles = []

// Update the loadFiles function to use our getAllFiles method
async function loadFiles() {
  const filesTable = document.getElementById("filesTable")
  filesTable.innerHTML = `
    <tr>
      <td colspan="6" class="text-center">
        <div class="loading-spinner">
          <i class="fas fa-spinner fa-spin"></i>
        </div>
      </td>
    </tr>
  `

  // Fetch node statuses first for UI display
  await fetchNodeStatuses();

  try {
    const { success, data } = await api.getAllFiles()

    if (success && data.length > 0) {
      allFiles = data
      displayFiles(currentPage)
      setupPagination()
    } else {
      filesTable.innerHTML = `
        <tr>
          <td colspan="6" class="text-center">No files found</td>
        </tr>
      `
    }
  } catch (error) {
    console.error("Error loading files:", error)
    filesTable.innerHTML = `
      <tr>
        <td colspan="6" class="text-center">Error loading files</td>
      </tr>
    `
  }
}

// Update the viewFileDetails function to use the actual API
async function viewFileDetails(fileId) {
  const modal = document.getElementById("fileDetailsModal")
  const modalContent = document.getElementById("fileDetailsContent")

  // Show modal with loading spinner
  modal.classList.add("active")
  modalContent.innerHTML = `
    <div class="loading-spinner">
      <i class="fas fa-spinner fa-spin"></i>
    </div>
  `

  try {
    const { success, data } = await api.getFileInfo(fileId)

    if (success) {
      // Format file size and date
      const fileSize = formatFileSize(data.size)
      const uploadDate = new Date(data.upload_date).toLocaleString()

      let locationsHtml = ""
      if (data.locations && data.locations.length > 0) {
          data.locations.forEach((location) => {
              locationsHtml += `
                  <div class="file-replica" data-node="${location.node_id}">
                      <div class="file-replica-header">
                          <span class="node-id">Node ${location.node_id}</span>
                          <span class="node-status ${getNodeClass(nodeStatuses[location.node_id])}">
                              ${getNodeStatusText(nodeStatuses[location.node_id])}
                          </span>
                      </div>
                      <div class="file-replica-details">
                          <div class="file-replica-path">${location.file_path}</div>
                      </div>
                  </div>
              `;
          });
      } else {
          locationsHtml = `
              <div class="no-replicas">
                  No file replicas found
              </div>
          `;
      }

      modalContent.innerHTML = `
        <div class="file-details">
          <div class="file-info">
            <div class="file-info-item">
              <div class="file-info-label">Filename</div>
              <div class="file-info-value">${data.original_filename}</div>
            </div>
            <div class="file-info-item">
              <div class="file-info-label">Size</div>
              <div class="file-info-value">${fileSize}</div>
            </div>
            <div class="file-info-item">
              <div class="file-info-label">Upload Date</div>
              <div class="file-info-value">${uploadDate}</div>
            </div>
            <div class="file-info-item">
              <div class="file-info-label">Owner</div>
              <div class="file-info-value">${data.username}</div>
            </div>
            <div class="file-info-item">
              <div class="file-info-label">Replicas</div>
              <div class="file-info-value">${data.locations ? data.locations.length : 0}</div>
            </div>
            <div class="file-info-item">
              <div class="file-info-label">System Filename</div>
              <div class="file-info-value">${data.filename}</div>
            </div>
          </div>
          
          <div class="file-replicas">
            <div class="file-replicas-header">
              <i class="fas fa-puzzle-piece"></i> File Replicas
            </div>
            ${locationsHtml}
          </div>
          
          <div class="file-actions">
            <a href="${api.getDownloadUrl(data.id)}" class="btn-file-action btn-download">
              <i class="fas fa-download"></i> Download File
            </a>
            <button class="btn-file-action btn-delete" onclick="deleteFileFromModal(${data.id})">
              <i class="fas fa-trash"></i> Delete File
            </button>
          </div>
        </div>
      `
    } else {
      modalContent.innerHTML = `
        <div class="text-center">Failed to load file details</div>
      `
    }
  } catch (error) {
    console.error("Error loading file details:", error)
    modalContent.innerHTML = `
      <div class="text-center">Error loading file details</div>
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
      loadFiles()
    } else {
      alert("Failed to delete file: " + (data.message || "Unknown error"))
    }
  } catch (error) {
    console.error("Error deleting file:", error)
    alert("Error deleting file")
  }
}

// Update the deleteFileFromModal function to use the actual API
async function deleteFileFromModal(fileId) {
  if (!confirm("Are you sure you want to delete this file?")) {
    return
  }

  try {
    const { success, data } = await api.deleteFile(fileId)

    if (success) {
      // Close modal
      document.getElementById("fileDetailsModal").classList.remove("active")

      // Reload files after deletion
      loadFiles()
    } else {
      alert("Failed to delete file: " + (data.message || "Unknown error"))
    }
  } catch (error) {
    console.error("Error deleting file:", error)
    alert("Error deleting file")
  }
}

function displayFiles(page) {
  const filesTable = document.getElementById("filesTable")
  const startIndex = (page - 1) * filesPerPage
  const endIndex = startIndex + filesPerPage
  const paginatedFiles = allFiles.slice(startIndex, endIndex)

  if (paginatedFiles.length === 0) {
    filesTable.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">No files found</td>
            </tr>
        `
    return
  }

  let filesHtml = ""

  paginatedFiles.forEach((file) => {
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
                <td>${file.nodes ? file.nodes.length : 0}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action btn-view-details" onclick="viewFileDetails(${file.id})">
                            <i class="fas fa-info-circle"></i> Details
                        </button>
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

  filesTable.innerHTML = filesHtml
}

function setupPagination() {
  const paginationContainer = document.getElementById("paginationContainer")
  const totalPages = Math.ceil(allFiles.length / filesPerPage)

  if (totalPages <= 1) {
    paginationContainer.innerHTML = ""
    return
  }

  let paginationHtml = '<ul class="pagination">'

  // Previous button
  paginationHtml += `
        <li class="pagination-item">
            <a href="#" class="pagination-link ${currentPage === 1 ? "disabled" : ""}" 
               onclick="changePage(${currentPage - 1})">
                <i class="fas fa-chevron-left"></i>
            </a>
        </li>
    `

  // Page numbers
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      paginationHtml += `
                <li class="pagination-item">
                    <a href="#" class="pagination-link ${i === currentPage ? "active" : ""}" 
                       onclick="changePage(${i})">
                        ${i}
                    </a>
                </li>
            `
    } else if (i === currentPage - 2 || i === currentPage + 2) {
      paginationHtml += `
                <li class="pagination-item">
                    <span class="pagination-link disabled">...</span>
                </li>
            `
    }
  }

  // Next button
  paginationHtml += `
        <li class="pagination-item">
            <a href="#" class="pagination-link ${currentPage === totalPages ? "disabled" : ""}" 
               onclick="changePage(${currentPage + 1})">
                <i class="fas fa-chevron-right"></i>
            </a>
        </li>
    `

  paginationHtml += "</ul>"
  paginationContainer.innerHTML = paginationHtml
}

function changePage(page) {
  const totalPages = Math.ceil(allFiles.length / filesPerPage)

  if (page < 1 || page > totalPages || page === currentPage) {
    return
  }

  currentPage = page
  displayFiles(currentPage)
  setupPagination()

  // Scroll to top of table
  document.querySelector(".data-table").scrollIntoView({ behavior: "smooth" })
}

function handleSearch() {
  const searchTerm = document.getElementById("fileSearch").value.toLowerCase().trim()

  if (!searchTerm) {
    // If search is empty, reset to show all files
    loadFiles()
    return
  }

  // Filter files based on search term
  const filteredFiles = allFiles.filter(
    (file) =>
      file.original_filename.toLowerCase().includes(searchTerm) || file.username.toLowerCase().includes(searchTerm),
  )

  // Update the global allFiles variable temporarily for pagination
  const originalFiles = [...allFiles]
  allFiles = filteredFiles

  // Reset to first page
  currentPage = 1

  // Display filtered files
  const filesTable = document.getElementById("filesTable")
  if (filteredFiles.length === 0) {
    filesTable.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">No files match your search</td>
            </tr>
        `
    document.getElementById("paginationContainer").innerHTML = ""
  } else {
    displayFiles(currentPage)
    setupPagination()
  }

  // Add a reset button if it doesn't exist
  if (!document.getElementById("resetSearchBtn")) {
    const searchContainer = document.querySelector(".search-container")
    const resetBtn = document.createElement("button")
    resetBtn.id = "resetSearchBtn"
    resetBtn.className = "btn-refresh"
    resetBtn.innerHTML = '<i class="fas fa-times"></i>'
    resetBtn.style.marginLeft = "5px"
    resetBtn.addEventListener("click", () => {
      document.getElementById("fileSearch").value = ""
      allFiles = originalFiles
      loadFiles()
      resetBtn.remove()
    })
    searchContainer.appendChild(resetBtn)
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

// Helper functions for node status display
function getNodeClass(status) {
  switch (status) {
    case 'healthy': return 'status-healthy';
    case 'failed': return 'status-failed';
    default: return 'status-unknown';
  }
}

function getNodeStatusText(status) {
  switch (status) {
    case 'healthy': return 'Healthy';
    case 'failed': return 'Failed';
    default: return 'Unknown';
  }
}
  
window.viewFileDetails = viewFileDetails;
window.deleteFile = deleteFile;
window.deleteFileFromModal = deleteFileFromModal;
  