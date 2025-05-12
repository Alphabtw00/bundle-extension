// Background script for the Axiom TrenchBot Bundle Info extension

// Listen for extension installation or update
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Axiom TrenchBot Bundle Info extension installed or updated:', details.reason);
  
  // Initialize default settings if it's a new installation
  if (details.reason === 'install') {
    chrome.storage.sync.set({
      extensionEnabled: true,
    });
  }
});

// Listen for messages from the content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  
  if (request.action === 'fetchDexScreener') {
    fetchDexScreenerData(request.pairAddress)
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Required to use sendResponse asynchronously
  }
  
  if (request.action === 'fetchTrenchBot') {
    fetchTrenchBotData(request.tokenAddress)
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Required to use sendResponse asynchronously
  }
  
  // Handle enabling/disabling the extension from popup
  if (request.action === 'setExtensionEnabled') {
    chrome.storage.sync.set({ extensionEnabled: request.enabled });
    
    // Send message to all tabs to update their state
    chrome.tabs.query({ url: '*://axiom.trade/*' }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { 
          action: 'toggleExtension',
          enabled: request.enabled
        });
      });
    });
    
    sendResponse({ success: true });
    return false;
  }
  
  // Relay status request to the active tab
  if (request.action === 'getStatus') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) {
        sendResponse({ error: 'No active tab' });
        return;
      }
      
      // Only try to get status if we're on axiom.trade
      if (tabs[0].url && tabs[0].url.includes('axiom.trade')) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'getStatus' }, (response) => {
          if (chrome.runtime.lastError) {
            // Content script not loaded or couldn't send message
            sendResponse({ 
              enabled: true, // Default
              onTokenPage: false,
              error: 'Content script not available'
            });
          } else {
            sendResponse(response);
          }
        });
      } else {
        // Not on axiom.trade
        sendResponse({ 
          enabled: true, // Default to enabled
          onTokenPage: false
        });
      }
    });
    return true; // Required to use sendResponse asynchronously
  }
});

// Fetch data from DexScreener API
async function fetchDexScreenerData(pairAddress) {
  try {
    console.log('Fetching from DexScreener:', pairAddress);
    const response = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${pairAddress}`);
    
    if (!response.ok) {
      throw new Error(`DexScreener API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching from DexScreener:', error);
    throw error;
  }
}

// Fetch data from TrenchBot API
async function fetchTrenchBotData(tokenAddress) {
  try {
    console.log('Fetching from TrenchBot:', tokenAddress);
    const response = await fetch(`https://trench.bot/api/bundle/bundle_full/${tokenAddress}`);
    
    if (!response.ok) {
      throw new Error(`TrenchBot API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching from TrenchBot:', error);
    throw error;
  }
}

// Handle browser action click (icon click)
chrome.action.onClicked.addListener((tab) => {
  // If not on Axiom, do nothing special
  if (!tab.url || !tab.url.includes('axiom.trade')) {
    return;
  }
  
  // If on Axiom, toggle the extension
  chrome.storage.sync.get(['extensionEnabled'], (result) => {
    const newState = !result.extensionEnabled;
    
    chrome.storage.sync.set({ extensionEnabled: newState });
    
    // Update icon to show enabled/disabled state
    updateExtensionIcon(newState);
    
    // Send message to the tab to update its state
    chrome.tabs.sendMessage(tab.id, { 
      action: 'toggleExtension',
      enabled: newState
    });
  });
});

// Update the extension icon based on enabled state
function updateExtensionIcon(enabled) {
  const iconPath = enabled 
    ? {
        16: "images/icon16.png",
        48: "images/icon48.png",
        128: "images/icon128.png"
      }
    : {
        16: "images/icon16_disabled.png",
        48: "images/icon48_disabled.png",
        128: "images/icon128_disabled.png"
      };
  
  chrome.action.setIcon({ path: iconPath });
}