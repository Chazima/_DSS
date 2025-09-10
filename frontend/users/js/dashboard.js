// User Dashboard JavaScript with integrated API functionality

// API implementation directly in this file
class UserAPI {
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

  async getFiles() {
    try {
      const response = await this.request('/files');
      if (response && response.ok) {
        const data = await response.json();
        return { success: true, data };
      }
      
      return { 
        success: false, 
        error: response ? 'API request failed' : 'No response from API',
        status: response ? response.status : 'no response'
      };
    } catch (error) {
      console.error('Error fetching files:', error);
      return { success: false, error: error.message };
    }
  }

  async getUserStorage() {
    try {
      const response = await this.request('/storage');
      if (response && response.ok) {
        const data = await response.json();
        return { success: true, data };
      }
      
      return { 
        success: false, 
        error: response ? 'API request failed' : 'No response from API',
        status: response ? response.status : 'no response'
      };
    } catch (error) {
      console.error('Error fetching storage info:', error);
      return { success: false, error: error.message };
    }
  }

  async uploadFile(fileFormData, onProgress) {
    const xhr = new XMLHttpRequest();
    
    return new Promise((resolve, reject) => {
      xhr.open('POST', `${this.baseUrl}/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${this.token}`);
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percentComplete = (event.loaded / event.total) * 100;
          onProgress(percentComplete);
        }
      };
      
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(xhr.statusText);
        }
      };
      
      xhr.onerror = () => reject(xhr.statusText);
      
      xhr.send(fileFormData);
    });
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
const api = new UserAPI();

// Dashboard functionality
document.addEventListener("DOMContentLoaded", () => {
  // Check if user is logged in
  const user = JSON.parse(localStorage.getItem("dfss_user") || "{}")
  if (!user.id) {
    window.location.href = "/frontend/login/index.html"
    return
  }

  // Set username in header
  document.getElementById("username").textContent = user.username

  // Initialize sidebar toggle
  initSidebar()

  // Load dashboard data
  loadUserStats()
  loadRecentFiles()

  // Setup event listeners
  document.getElementById("logoutBtn").addEventListener("click", () => api.logout())

  // Setup upload functionality
  setupUpload()
})

function initSidebar() {
  const sidebarToggle = document.getElementById("sidebarToggle")
  const sidebar = document.querySelector(".sidebar")

  sidebarToggle.addEventListener("click", () => {
    sidebar.classList.toggle("active")
  })
}

async function loadUserStats() {
  try {
    console.log("Loading user storage statistics...")
    
    // Check if we have a token
    const token = localStorage.getItem('dfss_token')
    if (!token) {
      console.error("No authentication token found")
      document.getElementById("totalFiles").textContent = "0"
      document.getElementById("storageUsed").textContent = "0.00 MB" 
      document.getElementById("storageLimit").textContent = "100.00 MB"
      return
    }
    
    // Using the getUserStorage method
    const response = await api.getUserStorage()
    console.log("API response:", response)

    if (response.success && response.data) {
      const data = response.data
      console.log("Storage data:", data)
      
      // Update stats in the cards
      document.getElementById("totalFiles").textContent = data.files_count || 0

      // Format storage sizes
      const usedSizeMB = (data.used_storage_bytes / (1024 * 1024)).toFixed(2)
      const totalSizeMB = (data.storage_limit_bytes / (1024 * 1024)).toFixed(2)
      const freeSizeMB = ((data.storage_limit_bytes - data.used_storage_bytes) / (1024 * 1024)).toFixed(2)

      document.getElementById("storageUsed").textContent = `${usedSizeMB} MB`
      document.getElementById("storageLimit").textContent = `${totalSizeMB} MB`

      // Update storage progress circle
      const usagePercent = Math.min(Math.round((data.used_storage_bytes / data.storage_limit_bytes) * 100), 100)
      document.getElementById("storageProgressPath").setAttribute("stroke-dasharray", `${usagePercent}, 100`)
      document.getElementById("storagePercentage").textContent = `${usagePercent}%`

      // Update storage details
      document.getElementById("usedStorage").textContent = `${usedSizeMB} MB`
      document.getElementById("freeStorage").textContent = `${freeSizeMB} MB`
      document.getElementById("totalStorage").textContent = `${totalSizeMB} MB`
    } else {
      console.error("Failed to load user statistics:", response)
      // Set default values if the API request fails
      document.getElementById("totalFiles").textContent = "0"
      document.getElementById("storageUsed").textContent = "0.00 MB" 
      document.getElementById("storageLimit").textContent = "100.00 MB"
      document.getElementById("storageProgressPath").setAttribute("stroke-dasharray", "0, 100")
      document.getElementById("storagePercentage").textContent = "0%"
      document.getElementById("usedStorage").textContent = "0.00 MB"
      document.getElementById("freeStorage").textContent = "100.00 MB"
      document.getElementById("totalStorage").textContent = "100.00 MB"
      
      showError("Failed to load user statistics")
    }
  } catch (error) {
    console.error("Error loading user statistics:", error)
    // Set default values if there's an error
    document.getElementById("totalFiles").textContent = "0"
    document.getElementById("storageUsed").textContent = "0.00 MB" 
    document.getElementById("storageLimit").textContent = "100.00 MB"
    document.getElementById("storageProgressPath").setAttribute("stroke-dasharray", "0, 100")
    document.getElementById("storagePercentage").textContent = "0%"
    document.getElementById("usedStorage").textContent = "0.00 MB"
    document.getElementById("freeStorage").textContent = "100.00 MB"
    document.getElementById("totalStorage").textContent = "100.00 MB"
    
    showError("Error loading user statistics")
  }
}

async function loadRecentFiles() {
  const recentFilesTable = document.getElementById("recentFilesTable")

  try {
    console.log("Loading recent files...")
    const response = await api.getFiles()
    console.log("Files API response:", response)

    if (response.success && response.data && response.data.length > 0) {
      let filesHtml = ""

      // Show only the 5 most recent files
      const recentFiles = response.data.slice(0, 5)

      recentFiles.forEach((file) => {
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
      console.log("No files found or API request failed, checking for development mode")
      
      // Check if in development mode to show mock files
      const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      
      if (isDevelopment) {
        console.log("Using mock file data for development")
        // Generate some mock files for development/testing
        const mockFiles = [
         
        ]
        
        let filesHtml = ""
        mockFiles.forEach((file) => {
          const fileSize = formatFileSize(file.size)
          const uploadDate = new Date(file.upload_date).toLocaleString()
          
          filesHtml += `
            <tr>
              <td>${file.original_filename}</td>
              <td>${fileSize}</td>
              <td>${uploadDate}</td>
              <td>
                <div class="action-buttons">
                  <a href="#" class="btn-action btn-download">
                    <i class="fas fa-download"></i> Download
                  </a>
                  <button class="btn-action btn-delete">
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
            <td colspan="4" class="text-center">No files found</td>
          </tr>
        `
      }
    }
  } catch (error) {
    console.error("Error loading recent files:", error)
    recentFilesTable.innerHTML = `
      <tr>
        <td colspan="4" class="text-center">Error loading files</td>
      </tr>
    `
  }
}

function setupUpload() {
  const dropzone = document.getElementById("uploadDropzone")
  const fileInput = document.getElementById("fileInput")
  const uploadForm = document.getElementById("quickUploadForm")
  const progressContainer = document.getElementById("uploadProgressContainer")
  const progressFill = document.getElementById("uploadProgressFill")
  const progressPercentage = document.getElementById("uploadPercentage")

  // Handle drag and drop events
  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault()
    dropzone.classList.add("active")
  })

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("active")
  })

  dropzone.addEventListener("drop", (e) => {
    e.preventDefault()
    dropzone.classList.remove("active")

    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files
    }
  })

  // Handle form submission
  uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault()

    const files = fileInput.files

    if (!files.length) {
      alert("Please select files to upload")
      return
    }

    // Show progress container
    progressContainer.style.display = "block"

    try {
      // For each file, upload it
      for (let i = 0; i < files.length; i++) {
        const file = files[i]

        // Update progress for current file
        progressPercentage.textContent = `Uploading file ${i + 1} of ${files.length}`

        // Upload the file
        const formData = new FormData()
        formData.append("file", file)

        const response = await api.uploadFile(formData, (progress) => {
          // Update progress bar
          const percent = Math.round(progress)
          progressFill.style.width = `${percent}%`
          progressPercentage.textContent = `${percent}%`
        })

        if (!response.success) {
          throw new Error(response.message || "Upload failed")
        }
      }

      // Reset form after successful upload
      uploadForm.reset()
      progressContainer.style.display = "none"

      // Reload user stats and recent files
      loadUserStats()
      loadRecentFiles()

      alert("Files uploaded successfully!")
    } catch (error) {
      console.error("Error uploading files:", error)
      alert("Error uploading files: " + error.message)
    }
  })
}

async function deleteFile(fileId) {
  if (!confirm("Are you sure you want to delete this file?")) {
    return
  }

  try {
    const { success, data } = await api.deleteFile(fileId)

    if (success) {
      // Reload files after deletion
      loadRecentFiles()
      loadUserStats()
    } else {
      alert("Failed to delete file: " + (data.message || "Unknown error"))
    }
  } catch (error) {
    console.error("Error deleting file:", error)
    alert("Error deleting file")
  }
}

function shareFile(fileId) {
  // Get the file sharing link
  const shareLink = api.getShareLink(fileId)

  // Copy to clipboard
  navigator.clipboard
    .writeText(shareLink)
    .then(() => {
      alert("Share link copied to clipboard!")
    })
    .catch((err) => {
      console.error("Error copying to clipboard:", err)
      alert("Share link: " + shareLink)
    })
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

function showError(message) {
  console.error(message)
  // You could implement a toast notification system here
}
