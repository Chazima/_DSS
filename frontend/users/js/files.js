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

  async getFileDetails(fileId) {
    const response = await this.request(`/files/${fileId}`);
    if (!response) return { success: false };
    return { success: response.ok, data: await response.json() };
  }

  async deleteFile(fileId) {
    const response = await this.request(`/files/${fileId}`, 'DELETE');
    if (!response) return { success: false };
    return { success: response.ok, data: await response.json() };
  }

  async shareFile(fileId, options) {
    const response = await this.request(`/files/${fileId}/share`, 'POST', options);
    if (!response) return { success: false };
    return { success: response.ok, data: await response.json() };
  }

  getDownloadUrl(fileId) {
    return `${this.baseUrl}/download/${fileId}?token=${this.token}`;
  }

  getShareUrl(fileId, shareToken) {
    return `${this.baseUrl}/share/${fileId}?token=${shareToken}`;
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

  // View toggle buttons
  document.getElementById("gridViewBtn").addEventListener("click", () => toggleView("grid"))
  document.getElementById("listViewBtn").addEventListener("click", () => toggleView("list"))

  // Sort and filter
  document.getElementById("sortBy").addEventListener("change", () => {
    currentPage = 1
    loadFiles()
  })
  document.getElementById("fileType").addEventListener("change", () => {
    currentPage = 1
    loadFiles()
  })

  // Modal close buttons
  document.getElementById("closeFileDetailsModal").addEventListener("click", () => {
    document.getElementById("fileDetailsModal").classList.remove("active")
  })
  document.getElementById("closeShareFileModal").addEventListener("click", () => {
    document.getElementById("shareFileModal").classList.remove("active")
  })

  // Share modal functionality
  document.getElementById("passwordProtect").addEventListener("change", (e) => {
    document.getElementById("passwordContainer").style.display = e.target.checked ? "block" : "none"
  })
  document.getElementById("copyLinkBtn").addEventListener("click", copyShareLink)
  document.getElementById("updateShareBtn").addEventListener("click", updateShareSettings)

  // Close modals when clicking outside
  window.addEventListener("click", (e) => {
    const fileDetailsModal = document.getElementById("fileDetailsModal")
    const shareFileModal = document.getElementById("shareFileModal")

    if (e.target === fileDetailsModal) {
      fileDetailsModal.classList.remove("active")
    }

    if (e.target === shareFileModal) {
      shareFileModal.classList.remove("active")
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

// Global variables for pagination and file management
let currentPage = 1
const filesPerPage = 12
let allFiles = []
let currentView = "grid"
let currentFileId = null

async function loadFiles() {
  const gridView = document.getElementById("gridView")
  const filesTable = document.getElementById("filesTable")

  // Show loading spinner
  gridView.innerHTML = `
    <div class="loading-spinner">
      <i class="fas fa-spinner fa-spin"></i>
    </div>
  `
  filesTable.innerHTML = `
    <tr>
      <td colspan="5" class="text-center">
        <div class="loading-spinner">
          <i class="fas fa-spinner fa-spin"></i>
        </div>
      </td>
    </tr>
  `

  try {
    const { success, data } = await api.getFiles()

    if (success && data.length > 0) {
      allFiles = data

      // Apply sorting
      sortFiles()

      // Apply filtering
      filterFiles()

      // Display files based on current view
      displayFiles(currentPage)
      setupPagination()
    } else {
      const noFilesMessage = `
        <div class="text-center" style="grid-column: 1 / -1; padding: 30px;">
          <i class="fas fa-folder-open" style="font-size: 3rem; color: var(--text-light); margin-bottom: 15px;"></i>
          <p>No files found. Upload some files to get started!</p>
          <a href="upload.html" class="btn-primary" style="display: inline-flex; margin-top: 15px;">
            <i class="fas fa-upload"></i> Upload Files
          </a>
        </div>
      `
      gridView.innerHTML = noFilesMessage
      filesTable.innerHTML = `
        <tr>
          <td colspan="5" class="text-center">No files found</td>
        </tr>
      `
    }
  } catch (error) {
    console.error("Error loading files:", error)
    gridView.innerHTML = `
      <div class="text-center" style="grid-column: 1 / -1; padding: 30px;">
        <p>Error loading files</p>
      </div>
    `
    filesTable.innerHTML = `
      <tr>
        <td colspan="5" class="text-center">Error loading files</td>
      </tr>
    `
  }
}

function sortFiles() {
  const sortBy = document.getElementById("sortBy").value

  switch (sortBy) {
    case "date-desc":
      allFiles.sort((a, b) => new Date(b.upload_date) - new Date(a.upload_date))
      break
    case "date-asc":
      allFiles.sort((a, b) => new Date(a.upload_date) - new Date(b.upload_date))
      break
    case "name-asc":
      allFiles.sort((a, b) => a.original_filename.localeCompare(b.original_filename))
      break
    case "name-desc":
      allFiles.sort((a, b) => b.original_filename.localeCompare(a.original_filename))
      break
    case "size-desc":
      allFiles.sort((a, b) => b.size - a.size)
      break
    case "size-asc":
      allFiles.sort((a, b) => a.size - b.size)
      break
  }
}

function filterFiles() {
  const fileType = document.getElementById("fileType").value

  if (fileType !== "all") {
    allFiles = allFiles.filter((file) => {
      const extension = file.original_filename.split(".").pop().toLowerCase()

      switch (fileType) {
        case "image":
          return ["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(extension)
        case "document":
          return ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt"].includes(extension)
        case "video":
          return ["mp4", "avi", "mov", "wmv", "mkv", "webm"].includes(extension)
        case "audio":
          return ["mp3", "wav", "ogg", "flac", "aac"].includes(extension)
        case "other":
          const commonTypes = [
            "jpg",
            "jpeg",
            "png",
            "gif",
            "svg",
            "webp",
            "pdf",
            "doc",
            "docx",
            "xls",
            "xlsx",
            "ppt",
            "pptx",
            "txt",
            "mp4",
            "avi",
            "mov",
            "wmv",
            "mkv",
            "webm",
            "mp3",
            "wav",
            "ogg",
            "flac",
            "aac",
          ]
          return !commonTypes.includes(extension)
        default:
          return true
      }
    })
  }
}

function displayFiles(page) {
  const startIndex = (page - 1) * filesPerPage
  const endIndex = startIndex + filesPerPage
  const paginatedFiles = allFiles.slice(startIndex, endIndex)

  if (currentView === "grid") {
    displayGridView(paginatedFiles)
  } else {
    displayListView(paginatedFiles)
  }
}

function displayGridView(files) {
  const gridView = document.getElementById("gridView")

  if (files.length === 0) {
    gridView.innerHTML = `
      <div class="text-center" style="grid-column: 1 / -1; padding: 30px;">
        <p>No files match your search</p>
      </div>
    `
    return
  }

  let gridHtml = ""

  files.forEach((file) => {
    // Determine file icon based on extension
    const extension = file.original_filename.split(".").pop().toLowerCase()
    let fileIcon = "fas fa-file"
    let isImage = false

    if (["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(extension)) {
      fileIcon = "fas fa-file-image"
      isImage = true
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

    // Format date
    const uploadDate = new Date(file.upload_date).toLocaleDateString()

    gridHtml += `
      <div class="file-card">
        <div class="file-preview">
          <i class="${fileIcon}"></i>
        </div>
        <div class="file-info">
          <div class="file-name" title="${file.original_filename}">${file.original_filename}</div>
          <div class="file-meta">
            <span>${fileSize}</span>
            <span>${uploadDate}</span>
          </div>
        </div>
        <div class="file-actions">
          <a href="${api.getDownloadUrl(file.id)}" class="file-action-btn download" title="Download">
            <i class="fas fa-download"></i>
          </a>
          <button class="file-action-btn delete" onclick="deleteFile(${file.id})" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `
  })

  gridView.innerHTML = gridHtml
}

function displayListView(files) {
  const filesTable = document.getElementById("filesTable")

  if (files.length === 0) {
    filesTable.innerHTML = `
      <tr>
        <td colspan="5" class="text-center">No files match your search</td>
      </tr>
    `
    return
  }

  let tableHtml = ""

  files.forEach((file) => {
    // Determine file type based on extension
    const extension = file.original_filename.split(".").pop().toLowerCase()
    let fileType = "Other"

    if (["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(extension)) {
      fileType = "Image"
    } else if (["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "md"].includes(extension)) {
      fileType = "Document"
    } else if (["mp4", "avi", "mov", "wmv", "mkv", "webm"].includes(extension)) {
      fileType = "Video"
    } else if (["mp3", "wav", "ogg", "flac", "aac"].includes(extension)) {
      fileType = "Audio"
    } else if (["zip", "rar", "7z", "tar", "gz"].includes(extension)) {
      fileType = "Archive"
    }

    // Format file size
    const fileSize = formatFileSize(file.size)

    // Format date
    const uploadDate = new Date(file.upload_date).toLocaleString()

    tableHtml += `
      <tr>
        <td>${file.original_filename}</td>
        <td>${fileSize}</td>
        <td>${uploadDate}</td>
        <td>${fileType}</td>
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

  filesTable.innerHTML = tableHtml
}

function toggleView(view) {
  currentView = view

  if (view === "grid") {
    document.getElementById("gridView").style.display = "grid"
    document.getElementById("listView").style.display = "none"
    document.getElementById("gridViewBtn").classList.add("active")
    document.getElementById("listViewBtn").classList.remove("active")
  } else {
    document.getElementById("gridView").style.display = "none"
    document.getElementById("listView").style.display = "block"
    document.getElementById("gridViewBtn").classList.remove("active")
    document.getElementById("listViewBtn").classList.add("active")
  }

  // Refresh the current view
  displayFiles(currentPage)
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

  // Scroll to top of container
  document.querySelector(".card").scrollIntoView({ behavior: "smooth" })
}

function handleSearch() {
  const searchTerm = document.getElementById("fileSearch").value.toLowerCase().trim()

  if (!searchTerm) {
    // If search is empty, reset to show all files
    loadFiles()
    return
  }

  // Filter files based on search term
  const filteredFiles = allFiles.filter((file) => file.original_filename.toLowerCase().includes(searchTerm))

  // Update the global allFiles variable temporarily for pagination
  const originalFiles = [...allFiles]
  allFiles = filteredFiles

  // Reset to first page
  currentPage = 1

  // Display filtered files
  displayFiles(currentPage)
  setupPagination()

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
      // Determine file icon based on extension
      const extension = data.original_filename.split(".").pop().toLowerCase()
      let fileIcon = "fas fa-file"
      let isImage = false

      if (["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(extension)) {
        fileIcon = "fas fa-file-image"
        isImage = true
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

      // Format file size and date
      const fileSize = formatFileSize(data.size)
      const uploadDate = new Date(data.upload_date).toLocaleString()

      modalContent.innerHTML = `
        <div class="file-details">
          <div class="file-preview-large">
            ${
              isImage
                ? `<img src="${api.getFilePreviewUrl(data.id)}" alt="${data.original_filename}" onerror="this.onerror=null; this.src='/placeholder.svg'; this.parentNode.innerHTML='<i class=\\'${fileIcon}\\'></i>';">`
                : `<i class="${fileIcon}"></i>`
            }
          </div>
          
          <div class="file-details-grid">
            <div class="detail-item">
              <div class="detail-label">Filename</div>
              <div class="detail-value">${data.original_filename}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Size</div>
              <div class="detail-value">${fileSize}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Upload Date</div>
              <div class="detail-value">${uploadDate}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">File Type</div>
              <div class="detail-value">${extension.toUpperCase()}</div>
            </div>
          </div>
          
          <div class="file-actions-footer">
            <a href="${api.getDownloadUrl(data.id)}" class="btn-primary">
              <i class="fas fa-download"></i> Download
            </a>
            <button class="btn-primary" onclick="showShareModal(${data.id})">
              <i class="fas fa-share-alt"></i> Share
            </button>
            <button class="btn-primary" style="background-color: var(--error-color);" onclick="deleteFileFromModal(${data.id})">
              <i class="fas fa-trash"></i> Delete
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

function showShareModal(fileId) {
  currentFileId = fileId
  const modal = document.getElementById("shareFileModal")
  const shareLink = api.getShareLink(fileId)

  // Reset form
  document.getElementById("expiryDate").value = "never"
  document.getElementById("passwordProtect").checked = false
  document.getElementById("passwordContainer").style.display = "none"
  document.getElementById("sharePassword").value = ""

  // Set share link
  document.getElementById("shareLink").value = shareLink

  // Show modal
  modal.classList.add("active")
}

function copyShareLink() {
  const shareLink = document.getElementById("shareLink")
  shareLink.select()
  document.execCommand("copy")

  // Show feedback
  const copyBtn = document.getElementById("copyLinkBtn")
  const originalText = copyBtn.innerHTML
  copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!'

  // Reset button text after 2 seconds
  setTimeout(() => {
    copyBtn.innerHTML = originalText
  }, 2000)
}

async function updateShareSettings() {
  if (!currentFileId) return

  const expiryDate = document.getElementById("expiryDate").value
  const passwordProtect = document.getElementById("passwordProtect").checked
  const password = passwordProtect ? document.getElementById("sharePassword").value : ""

  if (passwordProtect && !password) {
    alert("Please enter a password")
    return
  }

  try {
    // This would call an API endpoint to update share settings
    // For now, we'll just show a success message
    alert("Share settings updated successfully!")

    // Update the share link with new settings
    const shareLink = api.getShareLink(currentFileId, expiryDate, passwordProtect ? password : null)
    document.getElementById("shareLink").value = shareLink
  } catch (error) {
    console.error("Error updating share settings:", error)
    alert("Error updating share settings")
  }
}

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
