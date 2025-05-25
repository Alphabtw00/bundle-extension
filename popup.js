// Popup script for the Axiom TrenchBot Bundle Info extension

// Store DOM elements
let statusIndicator;
let statusText;
let extensionToggle;
let refreshButton;

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  // Get DOM elements
  statusIndicator = document.getElementById('status-indicator');
  statusText = document.getElementById('status-text');
  extensionToggle = document.getElementById('extension-toggle');
  refreshButton = document.getElementById('refresh-button');
  
  // Load extension enabled state from storage
  chrome.storage.sync.get(['extensionEnabled'], (result) => {
    extensionToggle.checked = result.extensionEnabled !== false; // Default to true
    updateUiForEnabledState(extensionToggle.checked);
  });
  
  // Set up event listeners
  extensionToggle.addEventListener('change', toggleExtensionState);
  refreshButton.addEventListener('click', refreshData);
  
  // Check extension status in current tab
  checkExtensionStatus();
});

// Update UI elements based on enabled state
function updateUiForEnabledState(isEnabled) {
  if (isEnabled) {
    extensionToggle.checked = true;
    refreshButton.disabled = false;
  } else {
    extensionToggle.checked = false;
    refreshButton.disabled = true;
  }
}

// Toggle extension enabled state
function toggleExtensionState() {
  const newState = extensionToggle.checked;
  
  // Save to storage
  chrome.storage.sync.set({ extensionEnabled: newState });
  
  // Update UI
  updateUiForEnabledState(newState);
  
  // Send message to active tabs
  chrome.tabs.query({ url: '*://axiom.trade/*' }, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { 
        action: 'toggleExtension', 
        enabled: newState 
      });
    });
  });
  
  // Update status text
  if (newState) {
    statusText.textContent = 'Extension is enabled';
  } else {
    statusText.textContent = 'Extension is disabled';
    statusIndicator.className = 'status-indicator inactive';
  }
  
  // Recheck after a delay to get updated status
  setTimeout(checkExtensionStatus, 500);
}

// Refresh data in the current page
function refreshData() {
  refreshButton.classList.add('refreshing');
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0) {
      showError('No active tab');
      return;
    }
    
    const currentTab = tabs[0];
    
    // Only try to refresh if we're on axiom.trade
    if (currentTab.url && currentTab.url.includes('axiom.trade')) {
      chrome.tabs.sendMessage(currentTab.id, { action: 'refreshData' }, (response) => {
        refreshButton.classList.remove('refreshing');
        
        if (chrome.runtime.lastError) {
          showError('Could not connect to page');
        } else if (response && response.success) {
          statusText.textContent = 'Data refreshed successfully';
          statusIndicator.className = 'status-indicator active';
          setTimeout(() => {
            checkExtensionStatus();
          }, 2000);
        } else if (response && !response.success && response.cooldownRemaining) {
          // Show cooldown message
          statusText.textContent = `Refresh on cooldown (${response.cooldownRemaining}s)`;
          refreshButton.disabled = true;
          statusIndicator.className = 'status-indicator waiting';
          
          // Re-enable after cooldown
          setTimeout(() => {
            refreshButton.disabled = false;
            checkExtensionStatus();
          }, response.cooldownRemaining * 1000);
        } else {
          showError(response?.error || 'Failed to refresh data');
        }
      });
    } else {
      refreshButton.classList.remove('refreshing');
      statusText.textContent = 'Extension only works on axiom.trade';
      statusIndicator.className = 'status-indicator inactive';
    }
  });
}

// Check the extension status on the current page
function checkExtensionStatus() {
  statusText.textContent = 'Checking status...';
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0) {
      showError('No active tab');
      return;
    }
    
    const currentTab = tabs[0];
    
    // Only try to get status if we're on axiom.trade
    if (currentTab.url && currentTab.url.includes('axiom.trade')) {
      chrome.tabs.sendMessage(currentTab.id, { action: 'getStatus' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          showError('Could not connect to page');
          return;
        }
        
        // Update toggle based on actual state
        if (response.hasOwnProperty('enabled')) {
          extensionToggle.checked = response.enabled;
          updateUiForEnabledState(response.enabled);
        }
        
        // Update refresh button based on cooldown
        if (response.hasOwnProperty('canRefresh')) {
          refreshButton.disabled = !response.canRefresh;
          if (!response.canRefresh) {
            refreshButton.title = `Wait ${response.cooldownRemaining}s`;
          } else {
            refreshButton.title = 'Refresh data';
          }
        }
        
        // Update status based on response
        if (response.onTokenPage) {
          statusIndicator.className = 'status-indicator active';
          let statusMsg = 'Active on current token page';
          
          if (response.currentTokenAddress) {
            const shortAddress = formatAddress(response.currentTokenAddress);
            statusMsg += ` (${shortAddress})`;
          }
          
          if (!response.canRefresh) {
            statusMsg += ` - Refresh in ${response.cooldownRemaining}s`;
          }
          
          statusText.textContent = statusMsg;
        } else {
          statusIndicator.className = 'status-indicator waiting';
          statusText.textContent = 'On Axiom, but not viewing a token page';
        }
      });
    } else {
      statusIndicator.className = 'status-indicator inactive';
      statusText.textContent = 'Extension only works on axiom.trade';
    }
  });
}

// Show error in status text
function showError(message) {
  statusIndicator.className = 'status-indicator error';
  statusText.textContent = `Error: ${message}`;
  refreshButton.classList.remove('refreshing');
}

// Format address for display
function formatAddress(address) {
  if (!address || address.length < 10) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}
