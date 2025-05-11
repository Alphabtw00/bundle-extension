// Popup script for the Axiom TrenchBot Bundle Info extension

// Function to check if the extension is active on the current page
async function checkExtensionStatus() {
    // Get the active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    
    // Check if we're on axiom.trade
    const isAxiomSite = currentTab.url.includes('axiom.trade');
    
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    
    if (isAxiomSite) {
      statusIndicator.classList.remove('inactive');
      statusIndicator.classList.add('active');
      statusText.textContent = 'Extension is active on this page';
    } else {
      statusIndicator.classList.remove('active');
      statusIndicator.classList.add('inactive');
      statusText.textContent = 'Extension only works on axiom.trade';
    }
  }
  
  // Function to refresh the current page
  function refreshPage() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs[0];
      
      // Check if we're on axiom.trade
      if (currentTab.url.includes('axiom.trade')) {
        // Execute the content script's init function again
        chrome.tabs.sendMessage(currentTab.id, { action: 'refreshData' });
        
        // Show a brief success message
        const statusText = document.getElementById('status-text');
        const originalText = statusText.textContent;
        statusText.textContent = 'Refreshing data...';
        
        // Restore the original status after 2 seconds
        setTimeout(() => {
          statusText.textContent = originalText;
        }, 2000);
      }
    });
  }
  
  // Set up event listeners when the popup loads
  document.addEventListener('DOMContentLoaded', () => {
    // Check the extension status
    checkExtensionStatus();
    
    // Set up the refresh button
    const refreshButton = document.getElementById('refresh-button');
    refreshButton.addEventListener('click', refreshPage);
  });