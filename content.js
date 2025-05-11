// Content script for Axiom TrenchBot Bundle Info extension
console.log('Axiom TrenchBot Bundle Info extension loaded');

// Store the current token address to avoid duplicate requests
let currentTokenAddress = '';
let observer = null;
let overlayAdded = false;
let bundleData = null;

// Main function to initialize the extension
function init() {
  console.log('Axiom TrenchBot Bundle Info extension initialized');
  
  // Start monitoring URL changes
  setupUrlChangeListener();
  
  // Process the initial page
  setTimeout(() => {
    processCurrentPage();
  }, 1500); // Wait a bit for the page to fully load
}

// Set up listeners for URL changes
function setupUrlChangeListener() {
  // Use mutation observer to detect DOM changes
  observer = new MutationObserver((mutations) => {
    checkForUrlChange();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Also check when the page's hash changes
  window.addEventListener('hashchange', checkForUrlChange);
  
  // Check periodically as fallback
  setInterval(checkForUrlChange, 2000);
}

// Function to check if URL has changed and a new token is being viewed
function checkForUrlChange() {
  const url = window.location.href;
  
  // Check if we're on a token page
  if (url.includes('axiom.trade/meme/') || url.includes('axiom.trade/token/')) {
    const parts = url.split('/');
    const tokenAddress = parts[parts.length - 1].split('?')[0]; // Remove query params if any
    
    if (tokenAddress && tokenAddress !== currentTokenAddress) {
      console.log('New token detected: ' + tokenAddress);
      currentTokenAddress = tokenAddress;
      overlayAdded = false;
      fetchTokenInfo(tokenAddress);
    } else if (!overlayAdded && bundleData) {
      // If URL hasn't changed but we haven't successfully added the overlay yet
      console.log('URL unchanged but trying again to add overlay');
      addOverlay(bundleData);
    }
  }
}

// Process the current page
function processCurrentPage() {
  const url = window.location.href;
  console.log('Processing current page: ' + url);
  
  // Check if we're on a token page
  if (url.includes('axiom.trade/meme/') || url.includes('axiom.trade/token/')) {
    const parts = url.split('/');
    const tokenAddress = parts[parts.length - 1].split('?')[0]; // Remove query params if any
    
    if (tokenAddress) {
      console.log('Token detected: ' + tokenAddress);
      currentTokenAddress = tokenAddress;
      fetchTokenInfo(tokenAddress);
    }
  }
}

// Fetch token info directly from TrenchBot using URL path
async function fetchTokenInfo(pairAddress) {
  try {
    console.log('Fetching token info for pair: ' + pairAddress);
    
    // First try to get the base token address (if needed)
    let tokenAddress = pairAddress;
    let tokenName = "Token";
    let tokenSymbol = "";
    
    // Sometimes we need to get the actual token address from DexScreener
    try {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${pairAddress}`);
      const data = await response.json();
      
      if (data && data.pairs && data.pairs.length > 0) {
        const baseToken = data.pairs[0].baseToken;
        tokenAddress = baseToken.address;
        tokenName = baseToken.name;
        tokenSymbol = baseToken.symbol;
        
        console.log(`Token found: ${tokenName} (${tokenSymbol}) - ${tokenAddress}`);
      }
    } catch (error) {
      console.log('Using original token address, DexScreener error:', error);
    }
    
    // Now fetch bundle info from trench.bot
    try {
      const response = await fetch(`https://trench.bot/api/bundle/bundle_full/${tokenAddress}`);
      const data = await response.json();
      
      console.log('TrenchBot response:', data);
      
      if (data) {
        const bundleInfo = {
          tokenName: tokenName,
          tokenSymbol: tokenSymbol,
          totalPercentageBundled: data.total_percentage_bundled || 0
        };
        
        console.log('Bundle info:', bundleInfo);
        bundleData = bundleInfo;
        
        // Add the overlay to the page
        addOverlay(bundleInfo);
      }
    } catch (error) {
      console.error('Error fetching bundle info:', error);
    }
  } catch (error) {
    console.error('Error in token info flow:', error);
  }
}

// Add a floating overlay with bundle info
function addOverlay(bundleInfo) {
  // Remove any existing overlay
  const existingOverlay = document.getElementById('trenchbot-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }
  
  // Create the overlay element
  const overlay = document.createElement('div');
  overlay.id = 'trenchbot-overlay';
  overlay.className = 'trenchbot-overlay';
  
  // Format the bundled percentage with color based on value
  const formattedPercentage = bundleInfo.totalPercentageBundled.toFixed(2);
  let colorClass = 'text-primaryGreen'; // Default color (green)
  
  if (bundleInfo.totalPercentageBundled >= 70) {
    colorClass = 'text-primaryRed'; // High bundling (red)
  } else if (bundleInfo.totalPercentageBundled >= 40) {
    colorClass = 'text-primaryYellow'; // Medium bundling (yellow)
  }
  
  // Create the content that matches Axiom's styling
  overlay.innerHTML = `
    <div class="border border-primaryStroke/50 pt-[6px] pb-[7px] px-[8px] flex flex-col w-full h-[55px] justify-start items-center rounded-[4px] gap-[8px]">
      <div class="flex flex-row h-[18px] gap-[4px] flex-1 justify-start items-center ${colorClass}">
        <img width="14" height="14" src="https://trench.bot/favicon.ico" style="border-radius: 50%;">
        <span class="text-[14px] leading-[16px] font-normal">${formattedPercentage}%</span>
        <button id="trenchbot-refresh" class="refresh-button" title="Refresh data">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
        </button>
      </div>
      <div class="flex flex-row flex-1 justify-start items-center">
        <span class="text-textTertiary text-[12px] leading-[16px] font-normal">TrenchBot Bundled</span>
      </div>
    </div>
    <button id="trenchbot-close" class="close-button">&times;</button>
  `;
  
  // Add the overlay to the document
  document.body.appendChild(overlay);
  
  // Add event listeners
  const refreshButton = document.getElementById('trenchbot-refresh');
  if (refreshButton) {
    refreshButton.addEventListener('click', (e) => {
      e.stopPropagation();
      refreshButton.classList.add('refreshing');
      fetchTokenInfo(currentTokenAddress);
    });
  }
  
  const closeButton = document.getElementById('trenchbot-close');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      overlay.style.display = 'none';
    });
  }
  
  // Allow dragging the overlay
  makeOverlayDraggable(overlay);
  
  // Add styles
  addOverlayStyles();
  
  overlayAdded = true;
  console.log('Overlay added successfully');
}

// Make the overlay draggable
function makeOverlayDraggable(overlay) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  
  overlay.addEventListener('mousedown', dragMouseDown);
  
  function dragMouseDown(e) {
    e.preventDefault();
    // Get the mouse cursor position at startup
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.addEventListener('mouseup', closeDragElement);
    document.addEventListener('mousemove', elementDrag);
  }
  
  function elementDrag(e) {
    e.preventDefault();
    // Calculate the new cursor position
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // Set the element's new position
    overlay.style.top = (overlay.offsetTop - pos2) + "px";
    overlay.style.left = (overlay.offsetLeft - pos1) + "px";
  }
  
  function closeDragElement() {
    // Stop moving when mouse button is released
    document.removeEventListener('mouseup', closeDragElement);
    document.removeEventListener('mousemove', elementDrag);
  }
}

// Add styles for the overlay
function addOverlayStyles() {
  if (document.getElementById('trenchbot-overlay-styles')) return;
  
  const styles = document.createElement('style');
  styles.id = 'trenchbot-overlay-styles';
  styles.textContent = `
    .trenchbot-overlay {
      position: fixed;
      top: 80px;
      right: 20px;
      width: 200px;
      z-index: 9999;
      background-color: #0f1013;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      cursor: move;
      user-select: none;
    }
    
    .text-primaryGreen {
      color: rgb(0, 230, 118);
    }
    
    .text-primaryRed {
      color: rgb(255, 68, 68);
    }
    
    .text-primaryYellow {
      color: rgb(255, 170, 0);
    }
    
    .text-textTertiary {
      color: rgb(130, 130, 140);
    }
    
    .close-button {
      position: absolute;
      top: 2px;
      right: 6px;
      font-size: 18px;
      color: rgb(130, 130, 140);
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      width: 20px;
      height: 20px;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .close-button:hover {
      color: white;
    }
    
    .refresh-button {
      background: none;
      border: none;
      color: inherit;
      cursor: pointer;
      padding: 0;
      margin-left: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .refresh-button:hover {
      opacity: 0.8;
    }
    
    .refreshing {
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;
  
  document.head.appendChild(styles);
  
  console.log('Overlay styles added');
}

// Handle messages from the popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request);
  
  if (request.action === 'refreshData') {
    // Clear current token address to force refresh
    fetchTokenInfo(currentTokenAddress);
    sendResponse({ success: true });
  } else if (request.action === 'checkPage') {
    // Just respond to let the sender know the content script is loaded
    sendResponse({ loaded: true, url: window.location.href });
  }
  
  return true; // Required for async response
});

// Initialize the extension
init();