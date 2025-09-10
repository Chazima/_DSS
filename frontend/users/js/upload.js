// API class implementation directly in this file
class API {
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
    const response = await this.request('/files');
    if (!response) return { success: false };
    return { success: response.ok, data: await response.json() };
  }

  async uploadFile(formData, progressCallback) {
    const url = `${this.baseUrl}/upload`;
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.open('POST', url, true);
      
      if (this.token) {
        xhr.setRequestHeader('Authorization', `Bearer ${this.token}`);
      }
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentage = Math.round((e.loaded * 100) / e.total);
          if (progressCallback) progressCallback(percentage);
        }
      });
      
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve({ success: true, data: response });
          } catch (e) {
            resolve({ success: true, data: xhr.responseText });
          }
        } else {
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            resolve({ success: false, data: errorResponse });
          } catch (e) {
            resolve({ success: false, data: { message: xhr.statusText } });
          }
        }
      };
      
      xhr.onerror = function() {
        reject(new Error('Network Error'));
      };
      
      xhr.send(formData);
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
const api = new API();

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
  
    // Load recent uploads
    loadRecentUploads()
  
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
  
  async function loadRecentUploads() {
    const recentUploadsTable = document.getElementById("recentUploadsTable")
  
    try {
      const { success, data } = await api.getFiles()
  
      if (success && data.length > 0) {
        let uploadsHtml = ""
        
        // Get most recent 5 uploads
        const recentFiles = data.slice(0, 5)
  
        recentFiles.forEach((file) => {
          // Format file size
          const fileSize = formatFileSize(file.size)
  
          // Format date
          const uploadDate = new Date(file.upload_date).toLocaleString()
  
          // Determine status
          let statusClass = "status-success"
          let statusText = "Completed"
  
          if (file.status === "pending") {
            statusClass = "status-pending"
            statusText = "Processing"
          } else if (file.status === "error") {
            statusClass = "status-error"
            statusText = "Failed"
          }
  
          uploadsHtml += `
            <tr>
              <td>${file.original_filename}</td>
              <td>${fileSize}</td>
              <td>${uploadDate}</td>
              <td><span class="status-badge ${statusClass}">${statusText}</span></td>
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
  
        recentUploadsTable.innerHTML = uploadsHtml
      } else {
        recentUploadsTable.innerHTML = `
          <tr>
            <td colspan="5" class="text-center">No recent uploads found</td>
          </tr>
        `
      }
    } catch (error) {
      console.error("Error loading recent uploads:", error)
      recentUploadsTable.innerHTML = `
        <tr>
          <td colspan="5" class="text-center">Error loading recent uploads</td>
        </tr>
      `
    }
  }
  
  function setupUpload() {
    const dropzone = document.getElementById("uploadDropzone")
    const fileInput = document.getElementById("fileInput")
    const selectedFilesContainer = document.getElementById("selectedFiles")
    const uploadBtn = document.getElementById("uploadBtn")
    const cancelBtn = document.getElementById("cancelUploadBtn")
    const uploadForm = document.getElementById("uploadForm")
    const uploadProgress = document.getElementById("uploadProgress")
    const progressFill = document.getElementById("progressFill")
    const progressPercentage = document.getElementById("progressPercentage")
    const progressFileName = document.getElementById("progressFileName")
    const progressStatus = document.getElementById("progressStatus")
  
    let selectedFiles = []
  
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
        handleFileSelection(e.dataTransfer.files)
      }
    })
  
    // Handle file input change
    fileInput.addEventListener("change", () => {
      if (fileInput.files.length) {
        handleFileSelection(fileInput.files)
      }
    })
  
    // Handle file selection
    function handleFileSelection(files) {
      // Add new files to the selected files array
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
  
        // Check if file already exists in the selection
        const fileExists = selectedFiles.some((f) => f.name === file.name && f.size === file.size)
  
        if (!fileExists) {
          selectedFiles.push(file)
        }
      }
  
      // Update the selected files display
      updateSelectedFilesDisplay()
  
      // Enable upload button if files are selected
      uploadBtn.disabled = selectedFiles.length === 0
    }
  
    // Update selected files display
    function updateSelectedFilesDisplay() {
      if (selectedFiles.length === 0) {
        selectedFilesContainer.innerHTML = `<div class="no-files-message">No files selected</div>`
        return
      }
  
      let filesHtml = ""
  
      selectedFiles.forEach((file, index) => {
        // Determine file icon based on extension
        const extension = file.name.split(".").pop().toLowerCase()
        let fileIcon = "fas fa-file"
  
        if (["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(extension)) {
          fileIcon = "fas fa-file-image"
        } else if (["pdf"].includes(extension)) {
          fileIcon = "fas fa-file-pdf"
        } else if (["doc", "docx"].includes(extension)) {
          fileIcon = "fas fa-file-word"
        } else if (["xls", "xlsx"].includes(extension)) {
          fileIcon = "fas fa-file-excel"
        } else if (["ppt", "pptx"].includes(extension)) {
          fileIcon = "fas fa-file-powerpoint"
        } else if (["zip", "rar", "7z", "tar", "gz"].includes(extension)) {
          fileIcon = "fas fa-file-archive"
        } else if (["mp4", "avi", "mov", "wmv", "mkv", "webm"].includes(extension)) {
          fileIcon = "fas fa-file-video"
        } else if (["mp3", "wav", "ogg", "flac", "aac"].includes(extension)) {
          fileIcon = "fas fa-file-audio"
        } else if (["txt", "md"].includes(extension)) {
          fileIcon = "fas fa-file-alt"
        }
  
        // Format file size
        const fileSize = formatFileSize(file.size)
  
        filesHtml += `
          <div class="file-item">
            <i class="${fileIcon} file-icon"></i>
            <div class="file-details">
              <div class="file-name">${file.name}</div>
              <div class="file-meta">${fileSize}</div>
            </div>
            <button type="button" class="file-remove" data-index="${index}">
              <i class="fas fa-times"></i>
            </button>
          </div>
        `
      })
  
      selectedFilesContainer.innerHTML = filesHtml
  
      // Add event listeners to remove buttons
      const removeButtons = document.querySelectorAll(".file-remove")
      removeButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const index = Number.parseInt(button.getAttribute("data-index"))
          selectedFiles.splice(index, 1)
          updateSelectedFilesDisplay()
          uploadBtn.disabled = selectedFiles.length === 0
        })
      })
    }
  
    // Handle form submission
    uploadForm.addEventListener("submit", async (e) => {
      e.preventDefault()
      
      // Get upload options
      const encrypt = document.getElementById("encryptFiles").checked
      const redundancy = document.getElementById("redundancyLevel").value
      
      // Prepare form data
      const formData = new FormData()
      for (const file of selectedFiles) {
        formData.append("file", file)
      }
      
      // Show upload progress
      uploadProgress.style.display = "block"
      progressFileName.textContent = selectedFiles.length > 1 
        ? `Uploading ${selectedFiles.length} files...` 
        : `Uploading ${selectedFiles[0].name}...`
      progressStatus.textContent = "Preparing files..."
      
      try {
        // Call the API to upload the files with options
        const result = await api.uploadFile(formData, (progress) => {
          progressFill.style.width = `${progress}%`
          progressPercentage.textContent = `${Math.round(progress)}%`
          
          if (progress < 100) {
            progressStatus.textContent = "Uploading..."
          } else {
            progressStatus.textContent = "Processing files..."
          }
        }, {
          encrypt: encrypt,
          redundancy: redundancy
        })
        
        if (result.success) {
          // Reset the form and selection
          selectedFiles = []
          updateSelectedFilesDisplay()
          uploadBtn.disabled = true
          uploadProgress.style.display = "none"
          
          // Reload the recent uploads
          loadRecentUploads()
          
          // Show success message
          alert("Files uploaded successfully!")
        } else {
          throw new Error(result.message || "Upload failed")
        }
      } catch (error) {
        console.error("Upload error:", error)
        progressStatus.textContent = "Upload failed: " + error.message
        progressFill.style.width = "0%"
      } finally {
        cancelBtn.disabled = true
      }
    })
  
    // Handle cancel button
    cancelBtn.addEventListener("click", () => {
      // In a real implementation, you would abort the fetch request
      // For now, we'll just reset the form
  
      // Reset form
      selectedFiles = []
      updateSelectedFilesDisplay()
      uploadForm.reset()
      uploadProgress.style.display = "none"
      uploadBtn.disabled = true
      cancelBtn.disabled = true
      fileInput.disabled = false
      document.getElementById("encryptFiles").disabled = false
      document.getElementById("redundancyLevel").disabled = false
    })
  }
  
  async function deleteFile(fileId) {
    if (confirm("Are you sure you want to delete this file?")) {
      try {
        const result = await api.deleteFile(fileId)
        
        if (result.success) {
          // Reload recent uploads
          loadRecentUploads()
        } else {
          alert("Failed to delete file: " + (result.message || "Unknown error"))
        }
      } catch (error) {
        console.error("Error deleting file:", error)
        alert("Error deleting file")
      }
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
  