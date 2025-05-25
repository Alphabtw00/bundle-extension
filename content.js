// TrenchBot Bundle Info Extension
// Optimized content script
(function() {
  'use strict';
  
  // State variables
  let currentTokenAddress = null;
  let overlayAdded = false;
  let bubbleMapVisible = false;
  let extensionEnabled = true;
  let observer = null;
  let d3Instance = null;
  let currentVisualization = null;
  let lastRefreshTime = 0;
  let bubbleMapData = null;
  const REFRESH_COOLDOWN = 5000; // 5 seconds
  
  // Wallet type icons
  const WALLET_ICONS = {
    regular: '👤',
    sniper: '🎯',
    new_wallet: '🆕',
    copy_trader: '🔄',
    team_bundle: '👨‍💻'
  };
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  function init() {
    console.log('TrenchBot Bundle Info extension initialized');
    
    // Load user preferences
    chrome.storage.sync.get(['extensionEnabled'], (result) => {
      if (result.hasOwnProperty('extensionEnabled')) {
        extensionEnabled = result.extensionEnabled;
      }
      
      // Load D3.js dynamically
      loadD3();
      
      // Setup URL change detection
      setupUrlChangeListener();
      
      // Process current page
      setTimeout(processCurrentPage, 500);
    });
    
    // Listen for messages
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'toggleExtension') {
        extensionEnabled = request.enabled;
        
        if (!extensionEnabled) {
          removeOverlay();
          removeBubbleMap();
        } else if (currentTokenAddress) {
          processTokenPage(currentTokenAddress);
        }
        
        sendResponse({ success: true });
      } else if (request.action === 'refreshData') {
        if (currentTokenAddress) {
          const now = Date.now();
          
          // Check if refresh is on cooldown
          if (now - lastRefreshTime < REFRESH_COOLDOWN) {
            sendResponse({ 
              success: false, 
              error: 'Refresh on cooldown', 
              cooldownRemaining: Math.ceil((REFRESH_COOLDOWN - (now - lastRefreshTime)) / 1000)
            });
          } else {
            removeOverlay();
            lastRefreshTime = now;
            processTokenPage(currentTokenAddress, true);
            sendResponse({ success: true });
          }
        } else {
          sendResponse({ success: false, error: 'No token page active' });
        }
        return true;
      } else if (request.action === 'getStatus') {
        const now = Date.now();
        const canRefresh = now - lastRefreshTime >= REFRESH_COOLDOWN;
        const cooldownRemaining = canRefresh ? 0 : Math.ceil((REFRESH_COOLDOWN - (now - lastRefreshTime)) / 1000);
        
        sendResponse({
          enabled: extensionEnabled,
          onTokenPage: isTokenPage(window.location.href),
          currentTokenAddress: currentTokenAddress,
          canRefresh: canRefresh,
          cooldownRemaining: cooldownRemaining
        });
      }
    });
  }
  
  function loadD3() {
    // Since D3 is loaded via manifest.json's content_scripts section before content.js,
    // it should already be available as window.d3
    if (window.d3) {
      console.log('D3.js is already loaded');
      d3Instance = window.d3;
      return Promise.resolve(window.d3);
    } else {
      console.error('D3.js is not available');
      return Promise.reject(new Error('D3.js is not available'));
    }
  }
  
  function setupUrlChangeListener() {
    // Clean up existing observer
    if (observer) {
      observer.disconnect();
    }
    
    // Watch for URL changes via history API
    window.addEventListener('popstate', checkForUrlChange);
    
    // Watch for DOM changes that might indicate navigation
    observer = new MutationObserver(checkForUrlChange);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Periodic check as fallback
    setInterval(checkForUrlChange, 2000);
  }
  
  function checkForUrlChange() {
    const url = window.location.href;
    
    if (isTokenPage(url)) {
      const tokenAddress = extractTokenAddress(url);
      
      if (tokenAddress && tokenAddress !== currentTokenAddress) {
        // Clear existing state when navigating to a new token
        removeOverlay();
        removeBubbleMap();
        
        currentTokenAddress = tokenAddress;
        
        if (extensionEnabled) {
          processTokenPage(tokenAddress);
        }
      }
    } else if (currentTokenAddress) {
      // Not on a token page anymore
      removeOverlay();
      removeBubbleMap();
      currentTokenAddress = null;
    }
  }
  
  function isTokenPage(url) {
    return url.includes('axiom.trade/meme/') || url.includes('axiom.trade/token/');
  }
  
  function extractTokenAddress(url) {
    const parts = url.split('/');
    return parts[parts.length - 1].split('?')[0]; // Remove query params
  }
  
  function processCurrentPage() {
    const url = window.location.href;
    
    if (isTokenPage(url)) {
      const tokenAddress = extractTokenAddress(url);
      
      if (tokenAddress) {
        currentTokenAddress = tokenAddress;
        
        if (extensionEnabled) {
          processTokenPage(tokenAddress);
        }
      }
    }
  }
  
  function processTokenPage(tokenAddress, forceRefresh = false) {
    // Fetch token data from background script (which handles caching)
    chrome.runtime.sendMessage(
      { action: 'fetchTokenInfo', tokenAddress, forceRefresh },
      (response) => {
        if (response && response.success) {
          // Store the data globally for potential refreshes of bubble map
          bubbleMapData = response.data;
          addOverlay(response.data, response.cacheAge || 0);
          
          // If bubble map is visible, refresh it too
          if (bubbleMapVisible) {
            updateBubbleMap(response.data);
          }
        } else {
          showErrorOverlay(response?.error || 'Unknown error');
        }
      }
    );
  }
  
  function addOverlay(bundleInfo, cacheAge) {
    // Remove any existing overlay
    removeOverlay();
    
    // Create the overlay element
    const overlay = document.createElement('div');
    overlay.id = 'trenchbot-overlay';
    overlay.className = 'trenchbot-overlay';
    
    // Format the bundled percentage with color based on value
    const formattedPercentage = bundleInfo.totalHoldingPercentage.toFixed(2);
    let colorClass = '';
    
    if (bundleInfo.totalHoldingPercentage >= 70) {
      colorClass = 'trenchbot-error-gradient'; // High bundling (red)
    } else if (bundleInfo.totalHoldingPercentage >= 40) {
      colorClass = 'trenchbot-warning-gradient'; // Medium bundling (yellow)
    } else {
      colorClass = 'trenchbot-success-gradient'; // Low bundling (green)
    }
    
    // Create a timestamp string
    let timeInfo = 'now';
    if (cacheAge > 0) {
      timeInfo = cacheAge > 60 
        ? `${Math.floor(cacheAge / 60)}m ${cacheAge % 60}s ago` 
        : `${cacheAge}s ago`;
    }
    
    // Simple compact design with minimal info
    overlay.innerHTML = `
      <div class="trenchbot-content">
        <div class="trenchbot-header">
          <img src="https://trench.bot/favicon.ico" alt="TrenchBot" width="16" height="16">
          <span class="trenchbot-percentage ${colorClass}">${formattedPercentage}%</span>
          <button id="trenchbot-refresh" class="trenchbot-refresh-button" title="Refresh data">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
          </button>
        </div>
        
        <div class="trenchbot-footer">
          <div class="trenchbot-info-row">
            <span class="trenchbot-label">Bundles: <span class="trenchbot-label-value">${bundleInfo.totalBundles || 0}</span></span>
            <span class="trenchbot-timestamp">${timeInfo}</span>
          </div>
          
          <div class="trenchbot-actions">
            <button id="trenchbot-more-info" class="trenchbot-btn trenchbot-btn-primary">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
              More Info
            </button>
          </div>
        </div>
      </div>
      <button id="trenchbot-close" class="trenchbot-close-button" title="Close">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;
    
    // Position at the top right
    overlay.style.top = '80px';
    overlay.style.right = '20px';
    
    // Add to document
    document.body.appendChild(overlay);
    
    // Store bundle data for bubble map
    overlay.bundleData = bundleInfo;
    
    // Set up event listeners
    setupOverlayEvents(overlay);
    
    overlayAdded = true;
  }
  
  function setupOverlayEvents(overlay) {
    // Refresh button
    const refreshButton = overlay.querySelector('#trenchbot-refresh');
    if (refreshButton) {
      refreshButton.addEventListener('click', (e) => {
        e.stopPropagation();
        
        const now = Date.now();
        // Check if on cooldown
        if (now - lastRefreshTime < REFRESH_COOLDOWN) {
          // Show cooldown visual feedback
          refreshButton.classList.add('trenchbot-cooldown');
          const remainingCooldown = Math.ceil((REFRESH_COOLDOWN - (now - lastRefreshTime)) / 1000);
          refreshButton.setAttribute('title', `Wait ${remainingCooldown}s`);
          
          // Remove cooldown class after remaining time
          setTimeout(() => {
            refreshButton.classList.remove('trenchbot-cooldown');
            refreshButton.setAttribute('title', 'Refresh data');
          }, REFRESH_COOLDOWN - (now - lastRefreshTime));
          
          return;
        }
        
        // Not on cooldown, perform refresh
        refreshButton.classList.add('trenchbot-refreshing');
        lastRefreshTime = now;
        processTokenPage(currentTokenAddress, true);
      });
    }
    
    // More info button
    const moreInfoButton = overlay.querySelector('#trenchbot-more-info');
    if (moreInfoButton) {
      moreInfoButton.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleBubbleMap(overlay.bundleData);
      });
    }
    
    // Close button
    const closeButton = overlay.querySelector('#trenchbot-close');
    if (closeButton) {
      closeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        overlay.remove();
        overlayAdded = false;
      });
    }
    
    // Make draggable
    makeElementDraggable(overlay);
  }
  
  function showErrorOverlay(errorMessage) {
    // Remove any existing overlay
    removeOverlay();
    
    // Create the overlay element
    const overlay = document.createElement('div');
    overlay.id = 'trenchbot-overlay';
    overlay.className = 'trenchbot-overlay';
    
    // Compact error overlay
    overlay.innerHTML = `
      <div class="trenchbot-content">
        <div class="trenchbot-header">
          <img src="https://trench.bot/favicon.ico" alt="TrenchBot" width="16" height="16">
          <span class="trenchbot-percentage trenchbot-error-gradient">Error</span>
          <button id="trenchbot-refresh" class="trenchbot-refresh-button" title="Refresh data">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
          </button>
        </div>
        
        <div class="trenchbot-footer">
          <div class="trenchbot-info-row">
            <span class="trenchbot-label" style="line-height: 1.3; text-align: center; width: 100%;">
              Bundle data not available for this token
            </span>
          </div>
          
          <div class="trenchbot-actions">
            <button id="trenchbot-refresh-error" class="trenchbot-btn">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
              </svg>
              Try Again
            </button>
          </div>
        </div>
      </div>
      <button id="trenchbot-close" class="trenchbot-close-button" title="Close">
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;
    
    // Position at the top right
    overlay.style.top = '80px';
    overlay.style.right = '20px';
    
    // Add to document
    document.body.appendChild(overlay);
    
    // Set up event listeners
    const refreshButton = overlay.querySelector('#trenchbot-refresh-error');
    if (refreshButton) {
      refreshButton.addEventListener('click', (e) => {
      e.stopPropagation();
        
      const now = Date.now();
      // Check if on cooldown
      if (now - lastRefreshTime < REFRESH_COOLDOWN) {
        // Show cooldown visual feedback
        refreshButton.classList.add('trenchbot-cooldown');
        const remainingCooldown = Math.ceil((REFRESH_COOLDOWN - (now - lastRefreshTime)) / 1000);
        refreshButton.setAttribute('title', `Wait ${remainingCooldown}s`);
        
        // Remove cooldown class after remaining time
        setTimeout(() => {
          refreshButton.classList.remove('trenchbot-cooldown');
          refreshButton.setAttribute('title', 'Try Again');
        }, REFRESH_COOLDOWN - (now - lastRefreshTime));
        
        return;
      }
      
      // Not on cooldown, perform refresh
      refreshButton.classList.add('trenchbot-refreshing');
      lastRefreshTime = now;
      processTokenPage(currentTokenAddress, true);
      });
    }
    
    const closeButton = overlay.querySelector('#trenchbot-close');
    if (closeButton) {
      closeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        overlay.remove();
        overlayAdded = false;
      });
    }
    
    // Make draggable with improved dragging
    makeElementDraggable(overlay);
    
    overlayAdded = true;
  }
  
  function removeOverlay() {
    const overlay = document.getElementById('trenchbot-overlay');
    if (overlay) {
      overlay.remove();
      overlayAdded = false;
    }
  }
  
  function toggleBubbleMap(bundleData) {
    if (bubbleMapVisible) {
      removeBubbleMap();
    } else {
      createBubbleMap(bundleData);
    }
  }
  
  function updateBubbleMap(bundleData) {
    // If bubble map is visible, update it with the new data
    if (bubbleMapVisible) {
      // Show loading overlay
      const bubbleMap = document.getElementById('trenchbot-bubble-map');
      
      if (bubbleMap) {
        // Add loading indicator
        const loading = document.createElement('div');
        loading.className = 'trenchbot-loading';
        loading.innerHTML = `
          <div class="trenchbot-loading-spinner"></div>
          <div class="trenchbot-loading-text">Refreshing data...</div>
        `;
        bubbleMap.appendChild(loading);
        
        // Update the map with new data after a short delay (for animation)
        setTimeout(() => {
          removeBubbleMap();
          createBubbleMap(bundleData);
        }, 800);
      }
    }
  }
  
  function removeBubbleMap() {
    const bubbleMap = document.getElementById('trenchbot-bubble-map');
    if (bubbleMap) {
      // Stop any running D3 simulation
      if (currentVisualization && currentVisualization.simulation) {
        currentVisualization.simulation.stop();
      }
      
      bubbleMap.remove();
      bubbleMapVisible = false;
      currentVisualization = null;
    }
  }
  
  function createBubbleMap(bundleData) {
    if (!bundleData || !bundleData.bundles) {
      console.error('No bundle data available');
      return;
    }
    
    // Remove existing map if any
    removeBubbleMap();
    
    // Create bubble map container
    const bubbleMap = document.createElement('div');
    bubbleMap.id = 'trenchbot-bubble-map';
    bubbleMap.className = 'trenchbot-bubble-map';
    
    // Get data for display
    const ticker = bundleData.ticker || bundleData.tokenSymbol || 'Token';
    const totalBundles = bundleData.totalBundles || 0;
    const solSpent = bundleData.totalSolSpent ? bundleData.totalSolSpent.toFixed(2) : '0.00';
    const bundledTotal = bundleData.totalPercentageBundled ? bundleData.totalPercentageBundled.toFixed(2) : '0.00';
    const holdPercentage = bundleData.totalHoldingPercentage ? bundleData.totalHoldingPercentage.toFixed(2) : '0.00';
    
    // Get wallet categories for filtering
    const walletCategories = new Set();
    Object.values(bundleData.bundles).forEach(bundle => {
      if (bundle.wallet_categories) {
        Object.values(bundle.wallet_categories).forEach(category => {
          walletCategories.add(category);
        });
      }
    });
    
    // Create bubble map UI with improved SVG icons
    bubbleMap.innerHTML = `
      <div class="trenchbot-bubble-map-header">
        <div class="trenchbot-bubble-map-title">
          <div class="trenchbot-bubble-map-ticker">
            <img src="https://trench.bot/favicon.ico" alt="TrenchBot">
            <span>Ticker: $${ticker}</span>
          </div>
          <div class="trenchbot-bubble-map-controls">
            <button id="trenchbot-refresh-bubbles" class="trenchbot-btn" title="Refresh Data">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
              </svg>
              Refresh
            </button>
            <button id="bubble-map-close" class="trenchbot-btn" title="Close">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Close
            </button>
          </div>
        </div>
        
        <div class="trenchbot-bubble-map-stats">
          <div class="trenchbot-stat-item">
            <div class="trenchbot-stat-label">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              Total Bundles
            </div>
            <div class="trenchbot-stat-value">${totalBundles}</div>
          </div>
          
          <div class="trenchbot-stat-item">
            <div class="trenchbot-stat-label">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M7.92 12.5a16 16 0 0 0 8.16 0 8 8 0 1 0-8.16 0z"></path>
              </svg>
              SOL Spent
            </div>
            <div class="trenchbot-stat-value">${solSpent} SOL</div>
          </div>
          
          <div class="trenchbot-stat-item">
            <div class="trenchbot-stat-label">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M16 12H8l4-4v8z"></path>
              </svg>
              Bundled Total
            </div>
            <div class="trenchbot-stat-value">${bundledTotal}%</div>
          </div>
          
          <div class="trenchbot-stat-item">
            <div class="trenchbot-stat-label">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="9" x2="15" y2="15"></line>
                <line x1="15" y1="9" x2="9" y2="15"></line>
              </svg>
              Hold Percentage
            </div>
            <div class="trenchbot-stat-value">${holdPercentage}%</div>
          </div>
        </div>
        
        <div class="trenchbot-bubble-map-filters">
          <div class="trenchbot-filter-group">
            <span class="trenchbot-filter-group-label">View:</span>
            <label class="trenchbot-filter-option">
              <input type="radio" name="view-filter" value="holding" checked> 
              <span>Holding</span>
            </label>
            <label class="trenchbot-filter-option">
              <input type="radio" name="view-filter" value="all"> 
              <span>All</span>
            </label>
          </div>
          
          <div class="trenchbot-filter-group">
            <span class="trenchbot-filter-group-label">Type:</span>
            <select id="wallet-type-filter" class="trenchbot-select">
              <option value="all">All Types</option>
              ${Array.from(walletCategories).map(category => 
                `<option value="${category}">${category.replace(/_/g, ' ')}</option>`
              ).join('')}
            </select>
          </div>
        </div>
      </div>
      
      <div class="trenchbot-bubbles-container"></div>
      
      <div class="trenchbot-bubble-map-legend">
        <div class="trenchbot-legend-item">
          <div class="trenchbot-legend-color trenchbot-legend-holding"></div>
          <span>Holding</span>
        </div>
        <div class="trenchbot-legend-item">
          <div class="trenchbot-legend-color trenchbot-legend-sold"></div>
          <span>Sold</span>
        </div>
        <div class="trenchbot-legend-item">
          <div class="trenchbot-legend-icon">👤</div>
          <span>Regular</span>
        </div>
        <div class="trenchbot-legend-item">
          <div class="trenchbot-legend-icon">🎯</div>
          <span>Sniper</span>
        </div>
        <div class="trenchbot-legend-item">
          <div class="trenchbot-legend-icon">🆕</div>
          <span>New Wallet</span>
        </div>
        <div class="trenchbot-legend-item">
          <div class="trenchbot-legend-icon">👨‍💻</div>
          <span>Team Bundle</span>
        </div>
        <div class="trenchbot-legend-item">
          <div class="trenchbot-legend-icon">🔄</div>
          <span>Copy Trader</span>
        </div>
      </div>
    `;
    
    // Add to document
    document.body.appendChild(bubbleMap);
    
    // Make the bubble map draggable
    makeElementDraggable(bubbleMap, '.trenchbot-bubble-map-title');
    
    // Get the bubbles container
    const bubblesContainer = bubbleMap.querySelector('.trenchbot-bubbles-container');
    
    // Set up event listeners
    bubbleMap.querySelector('#bubble-map-close').addEventListener('click', () => {
      removeBubbleMap();
    });
    
    // Set up refresh button in the bubble map
    bubbleMap.querySelector('#trenchbot-refresh-bubbles').addEventListener('click', () => {
      const now = Date.now();
      
      // Check if refresh is on cooldown
      if (now - lastRefreshTime < REFRESH_COOLDOWN) {
        const refreshBtn = bubbleMap.querySelector('#trenchbot-refresh-bubbles');
        refreshBtn.classList.add('trenchbot-btn-disabled');
        
        const remainingCooldown = Math.ceil((REFRESH_COOLDOWN - (now - lastRefreshTime)) / 1000);
        refreshBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
          Wait ${remainingCooldown}s
        `;
        
        setTimeout(() => {
          refreshBtn.classList.remove('trenchbot-btn-disabled');
          refreshBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
            Refresh
          `;
        }, REFRESH_COOLDOWN - (now - lastRefreshTime));
        
        return;
      }
      
      // Not on cooldown, perform refresh with animation
      lastRefreshTime = now;
      
      // Show loading indicator
      const loading = document.createElement('div');
      loading.className = 'trenchbot-loading';
      loading.innerHTML = `
        <div class="trenchbot-loading-spinner"></div>
        <div class="trenchbot-loading-text">Refreshing data...</div>
      `;
      bubbleMap.appendChild(loading);
      
      // Refresh data through main process
      processTokenPage(currentTokenAddress, true);
    });
    
    // Set up filter change handlers
    const viewFilters = bubbleMap.querySelectorAll('input[name="view-filter"]');
    viewFilters.forEach(filter => {
      filter.addEventListener('change', () => {
        renderBubbles(bubblesContainer, bundleData);
      });
    });
    
    const typeFilter = bubbleMap.querySelector('#wallet-type-filter');
    if (typeFilter) {
      typeFilter.addEventListener('change', () => {
        renderBubbles(bubblesContainer, bundleData);
      });
    }
    
    // Initial render of bubbles
    renderBubbles(bubblesContainer, bundleData);
    
    bubbleMapVisible = true;
  }

  function renderBubbles(container, bundleData) {
    // Get filter settings
    const showOnlyHolding = document.querySelector('input[name="view-filter"][value="holding"]').checked;
    const selectedType = document.querySelector('#wallet-type-filter').value;
    
    // Create data array from bundle info
    const bundles = Object.entries(bundleData.bundles).map(([id, bundle]) => ({
      id,
      ...bundle
    }));
    
    // Sort bundles by size (percentage) in descending order
    bundles.sort((a, b) => b.token_percentage - a.token_percentage);
    
    // Filter based on criteria
    const filteredBundles = bundles.filter(bundle => {
      // Skip if we're only showing holding wallets and this one has no holdings
      if (showOnlyHolding && bundle.holding_amount <= 0) {
        return false;
      }
      
      // Check if wallet type matches filter
      if (selectedType !== 'all') {
        // Only check primary category, ignore wallet_categories
        if (bundle.bundle_analysis && bundle.bundle_analysis.primary_category) {
          return bundle.bundle_analysis.primary_category === selectedType;
        }
        
        // If bundle analysis not available, fall back to first wallet category
        if (bundle.wallet_categories) {
          const primaryCategory = getPrimaryCategory(bundle);
          return primaryCategory === selectedType;
        }
        
        return false; // No matching category found
      }
      
      return true;
    });
    
    // Check if we have data after filtering
    if (filteredBundles.length === 0) {
      container.innerHTML = `
        <div class="trenchbot-no-data-message">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          No bundles match the current filters
        </div>
      `;
      return;
    }
    
    // If D3 is loaded, use it for visualization
    if (d3Instance) {
      createD3Visualization(container, filteredBundles);
    } else {
      // If D3 not loaded, use basic visualization instead
      createBasicVisualization(container, filteredBundles);
    }
  }

  function createBasicVisualization(container, bundles) {
    // Clear the container
    container.innerHTML = '';
    
    // Create a simple grid layout for the bundles
    const grid = document.createElement('div');
    grid.className = 'trenchbot-basic-grid';
    container.appendChild(grid);
    
    // Add each bundle as a simple circle
    bundles.forEach((bundle, index) => {
      const bubble = document.createElement('div');
      bubble.className = `trenchbot-basic-bubble`;
      
      // Get primary category
      const primaryCategory = getPrimaryCategory(bundle);
      const emoji = WALLET_ICONS[primaryCategory] || WALLET_ICONS.regular;
      
      // Size based on percentage
      const size = Math.max(40, Math.min(120, 40 + bundle.token_percentage * 1.5));
      bubble.style.width = `${size}px`;
      bubble.style.height = `${size}px`;
      
      // Calculate what percentage of this bundle's tokens are still held
      const totalTokenPercentage = bundle.token_percentage || 0;
      const holdingPercentage = bundle.holding_percentage || 0;
      
      // Calculate what percentage of this bundle's tokens are still held
      // If token_percentage is 0, avoid division by zero
      const holdingRatio = totalTokenPercentage > 0 ? 
                          (holdingPercentage / totalTokenPercentage * 100) : 0;
      
      // Get colors based on wallet type
      const colors = getWalletTypeColors(primaryCategory);
      
      // Add wallet category specific styling
      const walletTypeClass = `trenchbot-wallet-${primaryCategory.replace(/\s+/g, '_')}`;
      bubble.classList.add(walletTypeClass);
      
      // Apply pie chart effect using conic gradient with wallet-specific colors
      if (holdingRatio <= 0) {
        // All sold - color by wallet type
        bubble.style.background = colors.sold;
        bubble.style.border = `2px solid ${colors.soldStroke}`;
      } else if (holdingRatio >= 100) {
        // All holding - color by wallet type
        bubble.style.background = colors.holding;
        bubble.style.border = `2px solid ${colors.holdingStroke}`;
      } else {
        // Mixed - create pie effect with conic-gradient using wallet-specific colors
        bubble.style.background = `conic-gradient(
          ${colors.holding} 0% ${holdingRatio}%, 
          ${colors.sold} ${holdingRatio}% 100%
        )`;
        bubble.style.border = `2px solid ${colors.holdingStroke}`;
      }
      
      // Staggered appearance animation
      bubble.style.animationDelay = `${index * 30}ms`;
      
      // Add content
      bubble.innerHTML = `
        <div class="trenchbot-bubble-content">
          <div class="trenchbot-bubble-icon">${emoji}</div>
          <div class="trenchbot-bubble-percentage">${bundle.token_percentage.toFixed(2)}%</div>
        </div>
      `;
      
      // Add click handler
      bubble.addEventListener('click', () => {
        showBundleDetails(bundle);
      });
      
      // Add to grid
      grid.appendChild(bubble);
    });
  }
  
  function createD3Visualization(container, bundles) {
    // Clear the container
    container.innerHTML = '';
    
    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'trenchbot-tooltip';
    container.appendChild(tooltip);
    
    // Stop any existing simulation
    if (currentVisualization && currentVisualization.simulation) {
      currentVisualization.simulation.stop();
    }
    
    // Set up dimensions
    const containerRect = container.getBoundingClientRect();
    const width = containerRect.width;
    const height = containerRect.height;
    
    // Prepare nodes with sizing
    const nodes = bundles.map((bundle, i) => {
      // Calculate radius based on percentage
      const radius = calculateBubbleSize(bundle.token_percentage) / 2;
      
      return {
        index: i,
        ...bundle,
        radius: radius,
        x: Math.random() * (width - 2 * radius) + radius,  // Random initial position
        y: Math.random() * (height - 2 * radius) + radius,
        // Store category and holding status for visuals
        isHolding: bundle.holding_amount > 0,
        primaryCategory: getPrimaryCategory(bundle),
        // Add dragging property to track dragging state for each node
        isDragging: false
      };
    });
    
    // Create SVG container
    const svg = d3Instance.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('class', 'trenchbot-d3-svg')
      .attr('viewBox', [0, 0, width, height]);
    
    // Use the EXACT ORIGINAL force simulation from the working code
    const simulation = d3Instance.forceSimulation(nodes)
      .force("x", d3Instance.forceX(width/2).strength(0.02))
      .force("y", d3Instance.forceY(height/2).strength(0.02))
      .force("collision", d3Instance.forceCollide().radius(d => d.radius + 2).strength(1))
      .alpha(1)             // start hot so nodes settle into packed shape
      .alphaDecay(0.02)     // slow decay so simulation stays alive
      .alphaMin(0.001)
      .velocityDecay(0.4)
      .on('tick', ticked);
    
    // Create groups for each node
    const bubbleGroups = svg.selectAll('.bubble-group')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'trenchbot-bubble-group')
      .style('opacity', 0)  // Start invisible for animation
      .each(function(d, i) {
        // Animate entry with delay based on index
        d3Instance.select(this)
          .transition()
          .delay(i * 30)  // Staggered delay
          .duration(500)
          .style('opacity', 1);
      });
    
    // Add circles using arc paths to create pie charts
    bubbleGroups.each(function(d) {
      const group = d3Instance.select(this);
      
      // Calculate the ratio of holding to total tokens for this bundle
      const totalTokenPercentage = d.token_percentage || 0;
      const holdingPercentage = d.holding_percentage || 0;
      
      // Calculate what percentage of this bundle's tokens are still held
      // If token_percentage is 0, avoid division by zero
      const holdingRatio = totalTokenPercentage > 0 ? 
                        (holdingPercentage / totalTokenPercentage * 100) : 0;
      
      // Get colors based on wallet type
      const walletType = d.primaryCategory;
      let fillColors = getWalletTypeColors(walletType);
      
      // Create arc generator
      const arc = d3Instance.arc()
        .innerRadius(0)
        .outerRadius(d.radius);
      
      // Calculate angles for holding and sold portions
      const holdingAngle = 2 * Math.PI * (holdingRatio / 100);
      const soldAngle = 2 * Math.PI - holdingAngle;
      
      if (holdingRatio <= 0) {
        // Sold bubbles - more visible but clearly distinct from holding bubbles
        group.append('circle')
          .attr('r', d.radius)
          .attr('fill', 'rgba(120, 120, 140, 0.6)') // Light gray with good visibility
          .attr('stroke', fillColors.soldStroke)  // Add the stroke explicitly
          .attr('stroke-width', 1)
          .attr('class', `trenchbot-d3-circle trenchbot-sold trenchbot-wallet-${d.primaryCategory.replace(/\s+/g, '_')}`);
      }
      else if (holdingRatio >= 100) {
        // All holding - color by wallet type
        group.append('circle')
          .attr('r', d.radius)
          .attr('fill', fillColors.holding)
          .attr('stroke', fillColors.holdingStroke)
          .attr('filter', 'url(#glow)')
          .attr('stroke-width', 3)
          .attr('class', `trenchbot-d3-circle trenchbot-wallet-${d.primaryCategory.replace(/\s+/g, '_')}`);
      }
      else {
        // Partial holding - create pie chart with two arcs
        
        // Add holding segment (colored by wallet type)
        group.append('path')
          .attr('d', arc({
            startAngle: 0,
            endAngle: holdingAngle
          }))
          .attr('fill', fillColors.holding)
          .attr('stroke', fillColors.holdingStroke)
          .attr('stroke-width', 3)
          .attr('class', `trenchbot-d3-circle trenchbot-wallet-${d.primaryCategory.replace(/\s+/g, '_')}`);
        
        // Add sold segment (gray with tint of wallet color)
        group.append('path')
          .attr('d', arc({
            startAngle: holdingAngle,
            endAngle: 2 * Math.PI
          }))
          .attr('fill', fillColors.sold)
          .attr('stroke', fillColors.soldStroke)
          .attr('stroke-width', 3)
          .attr('class', `trenchbot-d3-circle trenchbot-wallet-${d.primaryCategory.replace(/\s+/g, '_')}`);
      }
    });
    
    // Add wallet type emoji
    bubbleGroups.append('text')
      .attr('class', 'trenchbot-d3-icon')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('dy', -5)
      .text(d => WALLET_ICONS[d.primaryCategory] || WALLET_ICONS.regular);
    
    // Add percentage text
    bubbleGroups.append('text')
      .attr('class', 'trenchbot-d3-percentage')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('dy', 10)
      .text(d => `${d.token_percentage.toFixed(2)}%`);
    
    // Set up tooltip behavior with delay - EXACTLY as before
    let tooltipTimeout;
    
    // Add event listeners for hover - ORIGINAL implementation
    bubbleGroups.on('mouseover', function(event, d) {
      // Clear any existing timeout
      if (tooltipTimeout) clearTimeout(tooltipTimeout);
      
      // Set a timeout before showing tooltip - 2+ seconds
      tooltipTimeout = setTimeout(() => {
        tooltip.style.display = 'block';
        tooltip.style.opacity = '1';
        
        // Create tooltip content
        tooltip.innerHTML = `
          <div class="trenchbot-tooltip-content">
            <div class="trenchbot-tooltip-header">Bundle Info</div>
            <div class="trenchbot-tooltip-row">
              <span class="trenchbot-tooltip-label">Token %:</span>
              <span class="trenchbot-tooltip-value">${d.token_percentage.toFixed(2)}%</span>
            </div>
            <div class="trenchbot-tooltip-row">
              <span class="trenchbot-tooltip-label">Holding %:</span>
              <span class="trenchbot-tooltip-value">${d.holding_percentage ? d.holding_percentage.toFixed(2) : '0.00'}%</span>
            </div>
            <div class="trenchbot-tooltip-row">
              <span class="trenchbot-tooltip-label">SOL:</span>
              <span class="trenchbot-tooltip-value">${d.total_sol ? d.total_sol.toFixed(2) : '0.00'}</span>
            </div>
            <div class="trenchbot-tooltip-row">
              <span class="trenchbot-tooltip-label">Wallets:</span>
              <span class="trenchbot-tooltip-value">${d.unique_wallets || 0}</span>
            </div>
            <div class="trenchbot-tooltip-row">
              <span class="trenchbot-tooltip-label">Type:</span>
              <span class="trenchbot-tooltip-value">${d.primaryCategory.replace(/_/g, ' ')}</span>
            </div>
          </div>
        `;
        
        // Position tooltip near the mouse but within viewport
        const mouseX = event.pageX;
        const mouseY = event.pageY;
        const tooltipRect = tooltip.getBoundingClientRect();
        
        // Ensure tooltip stays within viewport
        const posX = Math.min(mouseX + 10, window.innerWidth - tooltipRect.width - 10);
        const posY = Math.min(mouseY + 10, window.innerHeight - tooltipRect.height - 10);
        
        tooltip.style.left = `${posX}px`;
        tooltip.style.top = `${posY}px`;
        
        // Highlight the current bubble
        d3Instance.select(this).selectAll('.trenchbot-d3-circle')
          .attr('stroke-width', 3)
          .attr('stroke', '#fff');
      }, 2000); // 2 second delay before showing tooltip - as in original
    })
    .on('mousemove', function(event) {
      if (tooltip.style.display === 'block') {
        // Update tooltip position
        const mouseX = event.pageX;
        const mouseY = event.pageY;
        const tooltipRect = tooltip.getBoundingClientRect();
        
        const posX = Math.min(mouseX + 10, window.innerWidth - tooltipRect.width - 10);
        const posY = Math.min(mouseY + 10, window.innerHeight - tooltipRect.height - 10);
        
        tooltip.style.left = `${posX}px`;
        tooltip.style.top = `${posY}px`;
      }
    })
    .on('mouseout', function(event, d) {
      // Clear the timeout if we move out before it triggers
      if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
      }
      
      // Hide tooltip
      tooltip.style.opacity = '0';
      setTimeout(() => {
        tooltip.style.display = 'none';
      }, 200);
      
      // Reset bubble appearance - with the colors based on wallet type
      const colors = getWalletTypeColors(d.primaryCategory);
      const isHolding = d.holding_amount > 0;
      
      d3Instance.select(this).selectAll('.trenchbot-d3-circle')
        .attr('stroke-width', 2)
        .attr('stroke', isHolding ? colors.holdingStroke : colors.soldStroke);
    });
    
    // Add click handler separately from drag - EXACT original implementation
    bubbleGroups.on('click', function(event, d) {
      // Only show details if not dragging
      if (!d.isDragging) {
        showBundleDetails(d);
      }
      // Reset the dragging state
      d.isDragging = false;
    });
    
    // Set up drag behavior - EXACT original implementation
    bubbleGroups.call(d3Instance.drag()
      .on('start', function(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
        d.isDragging = false; // Initialize as not dragging
        d3Instance.select(this).selectAll('.trenchbot-d3-circle').attr('stroke', '#fff');
      })
      .on('drag', function(event, d) {
        d.fx = event.x;
        d.fy = event.y;
        // If moved more than a small amount, consider it a drag
        if (Math.abs(event.dx) > 3 || Math.abs(event.dy) > 3) {
          d.isDragging = true;
        }
      })
      .on('end', function(event, d) {
        // Get distance from center
        const centerX = width/2;
        const centerY = height/2;
        const dx = d.x - centerX;
        const dy = d.y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Heat up the simulation based on distance
        // The further we dragged, the more energy we inject
        simulation.alpha(Math.min(0.5, Math.max(0.1, distance / 300)));
        
        // Release fixed positions
        d.fx = null;
        d.fy = null;
        
        // Reset stroke - with wallet type colors
        const colors = getWalletTypeColors(d.primaryCategory);
        const isHolding = d.holding_amount > 0;
        
        d3Instance.select(this).selectAll('.trenchbot-d3-circle')
          .attr('stroke-width', 2)
          .attr('stroke', isHolding ? colors.holdingStroke : colors.soldStroke);
      })
    );
    
    // ORIGINAL Tick function
    function ticked() {
      nodes.forEach(function(d) {
        // Limit x position to stay within bounds (with some padding for the radius)
        d.x = Math.max(d.radius + 5, Math.min(width - d.radius - 5, d.x));
        // Limit y position to stay within bounds (with some padding for the radius)
        d.y = Math.max(d.radius + 5, Math.min(height - d.radius - 5, d.y));
      });
      // Update groups position
      bubbleGroups.attr('transform', d => `translate(${d.x},${d.y})`);
    }
    
    // Store visualization data for cleanup
    currentVisualization = {
      simulation,
      svg,
      nodes
    };
  }

  function showBundleDetails(bundle) {
    console.log('Showing bundle details for:', bundle);
    
    // Remove any existing details panel
    const existingPanel = document.getElementById('trenchbot-bundle-details');
    if (existingPanel) {
      existingPanel.remove();
    }
    
    // Create the details panel
    const detailsPanel = document.createElement('div');
    detailsPanel.id = 'trenchbot-bundle-details';
    detailsPanel.className = 'trenchbot-bundle-details-panel';
    
    // Calculate what percentage of this bundle's tokens are still held
    const totalTokenPercentage = bundle.token_percentage || 0;
    const holdingPercentage = bundle.holding_percentage || 0;
    const holdingRatio = totalTokenPercentage > 0 ? 
                      (holdingPercentage / totalTokenPercentage * 100) : 0;
    
    // Format numbers
    const formattedTotalPercentage = totalTokenPercentage.toFixed(2);
    const formattedHoldingPercentage = holdingPercentage.toFixed(2);
    const formattedSolSpent = bundle.total_sol ? bundle.total_sol.toFixed(2) : '0.00';
    const totalWallets = bundle.unique_wallets || 0;
    
    // Get wallet type and corresponding colors
    const primaryCategory = getPrimaryCategory(bundle);
    const categoryIcon = getCategoryEmoji(primaryCategory);
    const walletColors = getWalletTypeColors(primaryCategory);
    
    // Generate the panel content with a futuristic UI design
    detailsPanel.innerHTML = `
      <div class="trenchbot-details-header">
        <h3>
          <span class="trenchbot-details-icon" style="background: ${walletColors.holding}">
            ${categoryIcon}
          </span>
          Bundle Details
          <span class="trenchbot-details-percentage">${formattedTotalPercentage}%</span>
        </h3>
        <button id="trenchbot-details-close" class="trenchbot-details-close-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <div class="trenchbot-details-content">
        <div class="trenchbot-details-section">
          <h4>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            Overview
          </h4>
          
          <div class="trenchbot-detail-row">
            <span>Bundle Type</span>
            <span class="trenchbot-wallet-${primaryCategory}">
              ${categoryIcon} ${primaryCategory.replace(/_/g, ' ')}
            </span>
          </div>
          
          <div class="trenchbot-detail-row">
            <span>Token Percentage</span>
            <span>${formattedTotalPercentage}%</span>
          </div>
          
          <div class="trenchbot-detail-row">
            <span>Holding Percentage</span>
            <span class="${holdingRatio > 50 ? 'trenchbot-value-high' : 'trenchbot-value-low'}">
              ${formattedHoldingPercentage}% (${holdingRatio.toFixed(0)}% of bundle)
            </span>
          </div>
          
          <div class="trenchbot-detail-row">
            <span>SOL Spent</span>
            <span>${formattedSolSpent} SOL</span>
          </div>
          
          <div class="trenchbot-detail-row">
            <span>Unique Wallets</span>
            <span>${totalWallets}</span>
          </div>
        </div>
        
        <div class="trenchbot-details-section">
          <h4>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            Wallets
          </h4>
          
          <div class="trenchbot-wallets-list">
            ${generateWalletsList(bundle)}
          </div>
        </div>
      </div>
    `;
    
    // Add the panel to the bubble map
    const bubbleMap = document.getElementById('trenchbot-bubble-map');
    bubbleMap.appendChild(detailsPanel);
    
    // Set up event listener for close button
    const closeButton = detailsPanel.querySelector('#trenchbot-details-close');
    closeButton.addEventListener('click', () => {
      detailsPanel.remove();
    });
    
    // Apply entrance animation
    setTimeout(() => {
      detailsPanel.classList.add('active');
    }, 10);
  }

  function generateWalletsList(bundle) {
      // If no wallets data, show message
      if (!bundle.wallet_info || Object.keys(bundle.wallet_info).length === 0) {
        return `<div class="trenchbot-no-data">No wallet data available</div>`;
      }
      
      // Get colors for the wallet category
      const walletColors = getWalletTypeColors(getPrimaryCategory(bundle));
      
      // Generate wallet list HTML
      let walletsHtml = '';
      
      // Sort wallets by token amount (if available)
      const sortedWallets = Object.entries(bundle.wallet_info)
        .sort((a, b) => {
          const aAmount = a[1].tokens || 0;
          const bAmount = b[1].tokens || 0;
          return bAmount - aAmount;
        })
        .slice(0, 10); // Limit to top 10 wallets for performance
        
      sortedWallets.forEach(([address, data]) => {
        // Format wallet data
        const tokenAmount = data.tokens ? (data.tokens / 1e9).toFixed(2) : '0.00';
        const percentage = data.token_percentage ? data.token_percentage.toFixed(2) : '0.00';
        
        // Get wallet category from wallet_categories if available
        const category = bundle.wallet_categories && bundle.wallet_categories[address] 
                      ? bundle.wallet_categories[address] 
                      : 'regular';
        
        const categoryIcon = getCategoryEmoji(category);
        const holdingStatus = bundle.holding_amount && data.tokens > 0 ? 'Holding' : 'Sold';
        const holdingClass = holdingStatus === 'Holding' ? 'trenchbot-holding-status' : 'trenchbot-sold-status';
        
        // Generate wallet item with hover effects and clickable address
        walletsHtml += `
          <div class="trenchbot-wallet-item">
            <div class="trenchbot-wallet-info">
              <a href="https://solscan.io/account/${address}" 
                target="_blank" 
                class="trenchbot-wallet-address"
                title="View on Solscan">
                ${address.substring(0, 6)}...${address.substring(address.length - 4)}
                <svg class="trenchbot-external-link" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              </a>
              <span class="trenchbot-wallet-category ${category}">
                ${categoryIcon} ${category.replace(/_/g, ' ')}
              </span>
            </div>
            <div class="trenchbot-wallet-stats">
              <div class="trenchbot-wallet-stat">
                <span class="trenchbot-wallet-stat-label">Tokens:</span>
                <span class="trenchbot-wallet-stat-value">${tokenAmount}</span>
              </div>
              <div class="trenchbot-wallet-stat">
                <span class="trenchbot-wallet-stat-label">%:</span>
                <span class="trenchbot-wallet-stat-value">${percentage}%</span>
              </div>
              <div class="trenchbot-wallet-stat ${holdingClass}">
                <span class="trenchbot-wallet-stat-label">Status:</span>
                <span class="trenchbot-wallet-stat-value">${holdingStatus}</span>
              </div>
            </div>
          </div>
        `;
      });
      
      // If there are more wallets than what we displayed
      const remainingWallets = Object.keys(bundle.wallet_info).length - sortedWallets.length;
      if (remainingWallets > 0) {
        walletsHtml += `
          <div class="trenchbot-wallets-more">
            +${remainingWallets} more wallets not shown
          </div>
        `;
      }
      
      return walletsHtml;
  }

  function makeElementDraggable(element, handleSelector = null) {
    if (!element) return;
    
    const handle = handleSelector ? element.querySelector(handleSelector) : element;
    if (!handle) return;
    
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    handle.style.cursor = 'move';
    
    // Simple, reliable drag implementation
    handle.addEventListener('mousedown', function(e) {
      // Don't start drag if clicking on buttons
      if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
        return;
      }
      
      e.preventDefault();
      
      // Get the initial position
      startX = e.clientX;
      startY = e.clientY;
      
      const computedStyle = window.getComputedStyle(element);
      startLeft = parseInt(computedStyle.left, 10) || 0;
      startTop = parseInt(computedStyle.top, 10) || 0;
      
      isDragging = true;
      
      // Add document-wide handlers
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
    
    function onMouseMove(e) {
      if (!isDragging) return;
      
      // Simple position calculation
      const newLeft = startLeft + (e.clientX - startX);
      const newTop = startTop + (e.clientY - startY);
      
      // Direct position update - no transforms or fancy effects
      element.style.left = newLeft + 'px';
      element.style.top = newTop + 'px';
    }
    
    function onMouseUp() {
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
  }

  function getPrimaryCategory(bundle) {
    let primaryCategory = 'regular';
    if (bundle.bundle_analysis && bundle.bundle_analysis.primary_category) {
      primaryCategory = bundle.bundle_analysis.primary_category;
    } else if (bundle.wallet_categories) {
      // Just take the first one as primary if not specified
      const categories = Object.values(bundle.wallet_categories);
      if (categories.length > 0) {
        primaryCategory = categories[0];
      }
    }
    return primaryCategory;
  }
  
  function getCategoryEmoji(category) {
    return WALLET_ICONS[category] || WALLET_ICONS.regular;
  }
  
  // New function for getting colors based on wallet type
  function getWalletTypeColors(walletType) {
    switch(walletType) {
      case 'regular':
        return {
          holding: 'rgba(79, 124, 255, 0.7)', // Blue
          holdingStroke: 'rgba(79, 124, 255, 0.9)',
          sold: 'rgba(79, 124, 255, 0.3)',
          soldStroke: 'rgba(79, 124, 255, 0.5)'
        };
      case 'sniper':
        return {
          holding: 'rgba(255, 151, 79, 0.7)', // Orange
          holdingStroke: 'rgba(255, 151, 79, 0.9)',
          sold: 'rgba(255, 151, 79, 0.3)',
          soldStroke: 'rgba(255, 151, 79, 0.5)'
        };
      case 'new_wallet':
        return {
          holding: 'rgba(56, 239, 125, 0.7)', // Green
          holdingStroke: 'rgba(56, 239, 125, 0.9)',
          sold: 'rgba(56, 239, 125, 0.3)',
          soldStroke: 'rgba(56, 239, 125, 0.5)'
        };
      case 'team_bundle':
        return {
          holding: 'rgba(255, 79, 106, 0.7)', // Red
          holdingStroke: 'rgba(255, 79, 106, 0.9)',
          sold: 'rgba(255, 79, 106, 0.3)',
          soldStroke: 'rgba(255, 79, 106, 0.5)'
        };
      case 'copy_trader':
        return {
          holding: 'rgba(106, 69, 255, 0.7)', // Purple
          holdingStroke: 'rgba(106, 69, 255, 0.9)',
          sold: 'rgba(106, 69, 255, 0.3)',
          soldStroke: 'rgba(106, 69, 255, 0.5)'
        };
      default:
        return {
          holding: 'rgba(79, 124, 255, 0.7)', // Default Blue
          holdingStroke: 'rgba(79, 124, 255, 0.9)',
          sold: 'rgba(79, 124, 255, 0.3)',
          soldStroke: 'rgba(79, 124, 255, 0.5)'
        };
    }
  }

  function calculateBubbleSize(percentage) {
    const minSize = 20; // px
    const maxSize = 160; // px
    const maxPct  = 20;  // pct at which bubble reaches maxSize

    if (percentage <= 0) return minSize;

    // Compute circle areas for min and max radii
    const minArea = Math.PI * minSize * minSize;
    const maxArea = Math.PI * maxSize * maxSize;

    // Interpolate area linearly by percentage
    const area = minArea + (maxArea - minArea) * Math.min(1, percentage / maxPct);

    // Back to radius
    return Math.sqrt(area / Math.PI);
  }

})();
