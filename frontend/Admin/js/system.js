// Admin System Management with integrated API functionality

// Admin API implementation for system management
class SystemAdminAPI {
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

  async getSystemInfo() {
    const response = await this.request('/admin/system');
    if (!response) return { success: false };
    return { success: response.ok, data: await response.json() };
  }

  async getSystemNodes() {
    const response = await this.request('/admin/system/nodes');
    if (!response) return { success: false };
    
    try {
      const data = await response.json();
      return { success: response.ok, data: { nodes: data } };
    } catch (error) {
      console.error("Error parsing JSON response:", error);
      return { success: false, error: "Invalid response format" };
    }
  }
  
  async simulateNodeFailure(nodeId) {
    const response = await this.request(`/admin/system/fail-node/${nodeId}`, 'POST');
    if (!response) return { success: false };
    return { success: response.ok, data: await response.json() };
  }
  
  async repairNode(nodeId) {
    const response = await this.request(`/admin/system/repair-node/${nodeId}`, 'POST');
    if (!response) return { success: false };
    return { success: response.ok, data: await response.json() };
  }

  async getDetailedSystemInfo() {
    const response = await this.request('/admin/system/info');
    if (!response) return { success: false };
    return { success: response.ok, data: await response.json() };
  }
}

// Create API instance
const api = new SystemAdminAPI();

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
  
    // Load system data
    loadSystemOverview()
    loadNodeManagement()
  
    // Setup event listeners
    document.getElementById("logoutBtn").addEventListener("click", () => api.logout())
    document.getElementById("refreshSystem").addEventListener("click", () => {
      loadSystemOverview()
      loadNodeManagement()
    })
  
    // Setup node action buttons
    document.getElementById("simulateFailureBtn").addEventListener("click", simulateNodeFailure)
    document.getElementById("repairNodeBtn").addEventListener("click", repairNode)
  })
  
  function initSidebar() {
    const sidebarToggle = document.getElementById("sidebarToggle")
    const sidebar = document.querySelector(".sidebar")
  
    sidebarToggle.addEventListener("click", () => {
      sidebar.classList.toggle("active")
    })
  }
  
  async function loadSystemOverview() {
    try {
      const { success, data } = await api.getSystemInfo()
  
      if (success && data) {
        document.getElementById("totalUsers").textContent = data.total_users || 0
        document.getElementById("totalFiles").textContent = data.total_files || 0
        document.getElementById("activeNodes").textContent = data.node_count || 0
  
        // Format storage size
        const sizeInMB = (data.total_size_bytes / (1024 * 1024)).toFixed(2)
        document.getElementById("storageUsed").textContent = `${sizeInMB} MB`
      } else {
        showError("Failed to load system overview")
      }
    } catch (error) {
      console.error("Error loading system overview:", error)
      showError("Error loading system overview")
    }
  }
  
  async function loadNodeManagement() {
    const nodeManagementContainer = document.getElementById("nodeManagementContainer")
    const failNodeSelect = document.getElementById("failNodeSelect")
    const repairNodeSelect = document.getElementById("repairNodeSelect")
  
    nodeManagementContainer.innerHTML = `
          <div class="loading-spinner">
              <i class="fas fa-spinner fa-spin"></i>
          </div>
      `
  
    try {
      const { success, data } = await api.getSystemNodes()
  
      if (success && data && data.nodes) {
        // Clear select options
        failNodeSelect.innerHTML = '<option value="">Select Node</option>'
        repairNodeSelect.innerHTML = '<option value="">Select Node</option>'
  
        let nodesHtml = '<div class="node-grid">'
  
        data.nodes.forEach((node) => {
          // Calculate usage percentage
          const usagePercent = calculateStoragePercent(node.size_bytes)
          let progressClass = "healthy"
  
          if (usagePercent > 80) {
            progressClass = "warning"
          } else if (usagePercent > 95) {
            progressClass = "danger"
          }
  
          // Format size in MB
          const sizeMB = (node.size_bytes / (1024 * 1024)).toFixed(2)
  
          // Add to appropriate node select based on status
          if (node.status === 'healthy') {
            failNodeSelect.innerHTML += `<option value="${node.node_id}">Node ${node.node_id}</option>`
          } else if (node.status === 'failed') {
            repairNodeSelect.innerHTML += `<option value="${node.node_id}">Node ${node.node_id}</option>`
          }
          
          // Create node card based on status
          if (node.status === 'healthy') {
            nodesHtml += `
              <div class="node-detail-card">
                  <div class="node-header">
                      <div class="node-title">
                          <i class="fas fa-server"></i> Node ${node.node_id}
                      </div>
                      <div class="node-status status-healthy">
                          Healthy
                      </div>
                  </div>
                  <div class="node-body">
                      <div class="node-stats">
                          <div class="node-stat">
                              <div class="node-stat-value">${node.files_count}</div>
                              <div class="node-stat-label">Files</div>
                          </div>
                          <div class="node-stat">
                              <div class="node-stat-value">${sizeMB} MB</div>
                              <div class="node-stat-label">Used</div>
                          </div>
                      </div>
                      
                      <div class="node-progress">
                          <div class="node-progress-label">
                              <span>Storage Usage</span>
                              <span>${usagePercent}%</span>
                          </div>
                          <div class="progress-bar">
                              <div class="progress-fill ${progressClass}" style="width: ${usagePercent}%"></div>
                          </div>
                      </div>
                      
                      <!-- Simulate Failure button removed from here -->
                  </div>
              </div>
            `
          } else {
            nodesHtml += `
              <div class="node-detail-card">
                  <div class="node-header">
                      <div class="node-title">
                          <i class="fas fa-server"></i> Node ${node.node_id}
                      </div>
                      <div class="node-status status-failed">
                          Failed
                      </div>
                  </div>
                  <div class="node-body">
                      <div class="node-stats">
                          <div class="node-stat">
                              <div class="node-stat-value">N/A</div>
                              <div class="node-stat-label">Files</div>
                          </div>
                          <div class="node-stat">
                              <div class="node-stat-value">N/A</div>
                              <div class="node-stat-label">Used</div>
                          </div>
                      </div>
                      
                      <div class="node-progress">
                          <div class="node-progress-label">
                              <span>Storage Usage</span>
                              <span>N/A</span>
                          </div>
                          <div class="progress-bar">
                              <div class="progress-fill danger" style="width: 100%"></div>
                          </div>
                      </div>
                      
                      <div class="node-actions">
                          <button class="btn-action btn-success" onclick="repairNodeById(${node.node_id})">
                              <i class="fas fa-tools"></i> Repair Node
                          </button>
                      </div>
                  </div>
              </div>
            `
          }
        })
  
        nodesHtml += "</div>"
        nodeManagementContainer.innerHTML = nodesHtml
      } else {
        nodeManagementContainer.innerHTML = `
                  <div class="text-center">Failed to load node status</div>
              `
      }
    } catch (error) {
      console.error("Error loading node management:", error)
      nodeManagementContainer.innerHTML = `
              <div class="text-center">Error loading node management</div>
          `
    }
  }
  
  // This function would need to be implemented on the backend
  // For now, we'll simulate it
  async function getFailedNodes() {
    // In a real implementation, this would call an API endpoint
    // For now, we'll return an empty array or simulate a failed node
    return [] // Return node IDs of failed nodes
  }
  
  async function simulateNodeFailure() {
    const nodeId = document.getElementById("failNodeSelect").value
  
    if (!nodeId) {
      alert("Please select a node to simulate failure")
      return
    }
  
    if (!confirm(`Are you sure you want to simulate failure for Node ${nodeId}?`)) {
      return
    }
  
    try {
      const { success, data } = await api.simulateNodeFailure(nodeId)
      
      if (success) {
        alert(`Node ${nodeId} failure simulated successfully. The node is now marked as failed.`)
      } else {
        alert(`Error: ${data.message || 'Failed to simulate node failure'}`)
      }
  
      // Reload node management
      loadNodeManagement()
      loadSystemOverview()
    } catch (error) {
      console.error("Error simulating node failure:", error)
      alert("Error simulating node failure")
    }
  }
  
  function simulateFailureForNode(nodeId) {
    document.getElementById("failNodeSelect").value = nodeId
    simulateNodeFailure()
  }
  
  async function repairNode() {
    const nodeId = document.getElementById("repairNodeSelect").value
  
    if (!nodeId) {
      alert("Please select a node to repair")
      return
    }
  
    repairNodeById(nodeId)
  }
  
  async function repairNodeById(nodeId) {
    if (!confirm(`Are you sure you want to repair Node ${nodeId}?`)) {
      return
    }
  
    try {
      const { success, data } = await api.repairNode(nodeId)
      
      if (success) {
        alert(`Node ${nodeId} repaired successfully. Files have been restored.`)
      } else {
        alert(`Error: ${data.message || 'Failed to repair node'}`)
      }
  
      // Reload node management
      loadNodeManagement()
      loadSystemOverview()
    } catch (error) {
      console.error("Error repairing node:", error)
      alert("Error repairing node")
    }
  }
  
  // Helper Functions
  function calculateStoragePercent(bytes) {
    // For demo purposes, assume each node has 100MB capacity
    const nodeCapacity = 100 * 1024 * 1024 // 100MB in bytes
    return Math.min(Math.round((bytes / nodeCapacity) * 100), 100)
  }
  
  function showError(message) {
    console.error(message)
    // You could implement a toast notification system here
  }
  