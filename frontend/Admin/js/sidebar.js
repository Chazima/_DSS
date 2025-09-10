/**
 * Initialize sidebar toggle functionality
 */
export function initSidebar() {
  const sidebarToggle = document.getElementById('sidebarToggle');
  const appContainer = document.querySelector('.app-container');
  
  if (sidebarToggle && appContainer) {
    sidebarToggle.addEventListener('click', () => {
      appContainer.classList.toggle('sidebar-collapsed');
    });
  }
} 