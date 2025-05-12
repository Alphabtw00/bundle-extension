// Content script for Axiom TrenchBot Bundle Info extension
console.log('Axiom TrenchBot Bundle Info extension loaded');

// Store current state
let currentTokenAddress = '';
let observer = null;
let overlayAdded = false;
let bundleData = null;
let fullBundleData = null;
let extensionEnabled = true; // Default enabled
let bubbleMapVisible = false;

// Initialize the extension
function init() {
  console.log('Axiom TrenchBot Bundle Info extension initialized');
  
  // Load user preferences
  chrome.storage.sync.get(['extensionEnabled'], (result) => {
    if (result.hasOwnProperty('extensionEnabled')) {
      extensionEnabled = result.extensionEnabled;
      console.log('Extension enabled state loaded:', extensionEnabled);
    }
  });
  
  // Set up URL change listeners
  setupUrlChangeListener();
  
  // Process the initial page
  setTimeout(() => {
    processCurrentPage();
  }, 1500);
}

// Set up listeners for URL changes
function setupUrlChangeListener() {
  // Use mutation observer to detect DOM changes
  observer = new MutationObserver(() => {
    checkForUrlChange();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Also check when the hash changes
  window.addEventListener('hashchange', checkForUrlChange);
  
  // Check when page is navigated
  window.addEventListener('popstate', checkForUrlChange);
  
  // Check periodically as fallback
  setInterval(checkForUrlChange, 2000);
}

// Check if URL has changed and a new token is being viewed
function checkForUrlChange() {
  const url = window.location.href;
  
  // Check if we're on a token page
  if (isTokenPage(url)) {
    const parts = url.split('/');
    const tokenAddress = parts[parts.length - 1].split('?')[0]; // Remove query params
    
    if (tokenAddress && tokenAddress !== currentTokenAddress) {
      console.log('New token detected:', tokenAddress);
      currentTokenAddress = tokenAddress;
      
      // Reset state
      overlayAdded = false;
      bubbleMapVisible = false;
      
      if (extensionEnabled) {
        fetchTokenInfo(tokenAddress);
      }
    } else if (!overlayAdded && bundleData && extensionEnabled) {
      // If URL hasn't changed but we haven't successfully added the overlay yet
      console.log('Retrying overlay addition');
      addOverlay(bundleData);
    }
  } else {
    // Not on a token page, remove overlay if present
    removeOverlay();
    currentTokenAddress = '';
  }
}

// Check if the current URL is a token page
function isTokenPage(url) {
  return url.includes('axiom.trade/meme/') || url.includes('axiom.trade/token/');
}

// Process the current page
function processCurrentPage() {
  const url = window.location.href;
  console.log('Processing current page:', url);
  
  if (isTokenPage(url)) {
    const parts = url.split('/');
    const tokenAddress = parts[parts.length - 1].split('?')[0];
    
    if (tokenAddress) {
      console.log('Token detected:', tokenAddress);
      currentTokenAddress = tokenAddress;
      
      if (extensionEnabled) {
        fetchTokenInfo(tokenAddress);
      }
    }
  }
}

// Remove the overlay
function removeOverlay() {
  const overlay = document.getElementById('trenchbot-overlay');
  if (overlay) {
    overlay.remove();
  }
  
  const bubbleMap = document.getElementById('trenchbot-bubble-map');
  if (bubbleMap) {
    bubbleMap.remove();
  }
  
  overlayAdded = false;
  bubbleMapVisible = false;
}

// Fetch token info from TrenchBot
async function fetchTokenInfo(pairAddress) {
  try {
    console.log('Fetching token info for pair:', pairAddress);
    
    // First try to get the base token address (if needed)
    let tokenAddress = pairAddress;
    let tokenName = "Token";
    let tokenSymbol = "";
    
    try {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${pairAddress}`);
      
      if (!response.ok) {
        throw new Error(`DexScreener API error: ${response.status}`);
      }
      
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
      
      if (!response.ok) {
        throw new Error(`TrenchBot API error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('TrenchBot response:', data);
      
      if (data) {
        fullBundleData = data; // Store the full data for the bubble map
        
        const bundleInfo = {
          tokenName: tokenName,
          tokenSymbol: tokenSymbol,
          tokenAddress: tokenAddress,
          totalPercentageBundled: data.total_percentage_bundled || 0,
          totalHoldingPercentage: data.total_holding_percentage || 0,
          totalBundles: data.total_bundles || 0,
          totalSolSpent: data.total_sol_spent || 0
        };
        
        console.log('Bundle info:', bundleInfo);
        bundleData = bundleInfo;
        
        // Add the overlay to the page
        if (extensionEnabled) {
          addOverlay(bundleInfo);
        }
      }
    } catch (error) {
      console.error('Error fetching bundle info:', error);
      showErrorOverlay(error.message);
    }
  } catch (error) {
    console.error('Error in token info flow:', error);
    showErrorOverlay(error.message);
  }
}

// Show error in the overlay
function showErrorOverlay(errorMessage) {
  const existingOverlay = document.getElementById('trenchbot-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }
  
  const overlay = document.createElement('div');
  overlay.id = 'trenchbot-overlay';
  overlay.className = 'trenchbot-overlay';
  
  overlay.innerHTML = `
    <div class="trenchbot-content">
      <div class="trenchbot-header trenchbot-error">
        <img width="14" height="14" src="https://trench.bot/favicon.ico" style="border-radius: 50%;">
        <span class="trenchbot-percentage">Error</span>
        <button id="trenchbot-refresh" class="trenchbot-refresh-button" title="Refresh data">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
        </button>
      </div>
      <div class="trenchbot-footer">
        <span class="trenchbot-label">TrenchBot API Error</span>
      </div>
    </div>
    <button id="trenchbot-close" class="trenchbot-close-button">&times;</button>
  `;
  
  document.body.appendChild(overlay);
  
  // Add event listeners
  const refreshButton = document.getElementById('trenchbot-refresh');
  if (refreshButton) {
    refreshButton.addEventListener('click', (e) => {
      e.stopPropagation();
      refreshButton.classList.add('trenchbot-refreshing');
      fetchTokenInfo(currentTokenAddress);
    });
  }
  
  const closeButton = document.getElementById('trenchbot-close');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      overlay.remove();
      overlayAdded = false;
    });
  }
  
  makeOverlayDraggable(overlay);
  addOverlayStyles();
  
  overlayAdded = true;
  console.log('Error overlay added');
}

// Add the main overlay with bundle info
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
  const formattedPercentage = bundleInfo.totalHoldingPercentage.toFixed(2);
  let colorClass = 'trenchbot-green'; // Default color (green)
  
  if (bundleInfo.totalHoldingPercentage >= 70) {
    colorClass = 'trenchbot-red'; // High bundling (red)
  } else if (bundleInfo.totalHoldingPercentage >= 40) {
    colorClass = 'trenchbot-yellow'; // Medium bundling (yellow)
  }
  
  overlay.innerHTML = `
    <div class="trenchbot-content">
      <div class="trenchbot-header ${colorClass}">
        <img width="14" height="14" src="https://trench.bot/favicon.ico" style="border-radius: 50%;">
        <span class="trenchbot-percentage">${formattedPercentage}%</span>
        <button id="trenchbot-refresh" class="trenchbot-refresh-button" title="Refresh data">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
        </button>
      </div>
      <div class="trenchbot-footer">
        <span class="trenchbot-label">TrenchBot Holding</span>
        <button id="trenchbot-more-info" class="trenchbot-more-info-button">
          <span>More Info</span>
        </button>
      </div>
    </div>
    <button id="trenchbot-close" class="trenchbot-close-button" title="Close">&times;</button>
  `;
  
  // Add the overlay to the document
  document.body.appendChild(overlay);
  
  // Position at the bottom of the screen instead of top-right
  overlay.style.top = '80px';
  overlay.style.right = '20px';
  overlay.style.bottom = 'auto';
  
  // Add event listeners
  const refreshButton = document.getElementById('trenchbot-refresh');
  if (refreshButton) {
    refreshButton.addEventListener('click', (e) => {
      e.stopPropagation();
      refreshButton.classList.add('trenchbot-refreshing');
      fetchTokenInfo(currentTokenAddress);
    });
  }
  
  const moreInfoButton = document.getElementById('trenchbot-more-info');
  if (moreInfoButton) {
    moreInfoButton.addEventListener('click', () => {
      toggleBubbleMap();
    });
  }
  
  const closeButton = document.getElementById('trenchbot-close');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      overlay.remove();
      overlayAdded = false;
    });
  }
  
  // Make the overlay draggable
  makeOverlayDraggable(overlay);
  
  // Add styles
  addOverlayStyles();
  
  overlayAdded = true;
  console.log('Overlay added successfully');
}

// Toggle the bubble map display
function toggleBubbleMap() {
  if (bubbleMapVisible) {
    // Remove existing bubble map
    const bubbleMap = document.getElementById('trenchbot-bubble-map');
    if (bubbleMap) {
      bubbleMap.remove();
      bubbleMapVisible = false;
    }
  } else {
    // Create and show bubble map
    createBubbleMap();
    bubbleMapVisible = true;
  }
}

// Create and display the bubble map visualization
function createBubbleMap() {
  // Check if we have the full data needed
  if (!fullBundleData || !fullBundleData.bundles) {
    console.error('No bundle data available for bubble map');
    return;
  }
  
  // Remove existing bubble map if any
  const existingBubbleMap = document.getElementById('trenchbot-bubble-map');
  if (existingBubbleMap) {
    existingBubbleMap.remove();
  }
  
  // Create the bubble map container
  const bubbleMap = document.createElement('div');
  bubbleMap.id = 'trenchbot-bubble-map';
  bubbleMap.className = 'trenchbot-bubble-map';
  
  // Get ticker and other stats
  const ticker = fullBundleData.ticker || 'Token';
  const totalBundles = fullBundleData.total_bundles || 0;
  const solSpent = fullBundleData.total_sol_spent ? fullBundleData.total_sol_spent.toFixed(2) : '0.00';
  const bundledTotal = fullBundleData.total_percentage_bundled ? fullBundleData.total_percentage_bundled.toFixed(2) : '0.00';
  const holdPercentage = fullBundleData.total_holding_percentage ? fullBundleData.total_holding_percentage.toFixed(2) : '0.00';
  
  // Get the list of wallet categories for filtering
  const walletCategories = new Set();
  if (fullBundleData.bundles) {
    Object.values(fullBundleData.bundles).forEach(bundle => {
      if (bundle.wallet_categories) {
        Object.values(bundle.wallet_categories).forEach(category => {
          walletCategories.add(category);
        });
      }
    });
  }
  
  // Create the bubble map content
  bubbleMap.innerHTML = `
    <div class="trenchbot-bubble-map-header">
      <div class="trenchbot-bubble-map-title">
        <div class="trenchbot-bubble-map-ticker">
          <img width="16" height="16" src="https://trench.bot/favicon.ico" style="border-radius: 50%; margin-right: 8px;">
          <span>Ticker: ${ticker}</span>
        </div>
        <div class="trenchbot-bubble-map-controls">
          <button id="bubble-map-close" class="trenchbot-close-button" title="Close">&times;</button>
        </div>
      </div>
      
      <div class="trenchbot-bubble-map-stats">
        <div class="trenchbot-stat-item">
          <span class="trenchbot-stat-label">Total Bundles:</span>
          <span class="trenchbot-stat-value">${totalBundles}</span>
        </div>
        <div class="trenchbot-stat-item">
          <span class="trenchbot-stat-label">SOL Spent:</span>
          <span class="trenchbot-stat-value">${solSpent} SOL</span>
        </div>
        <div class="trenchbot-stat-item">
          <span class="trenchbot-stat-label">Bundled Total:</span>
          <span class="trenchbot-stat-value">${bundledTotal}%</span>
        </div>
        <div class="trenchbot-stat-item">
          <span class="trenchbot-stat-label">Hold Percentage:</span>
          <span class="trenchbot-stat-value">${holdPercentage}%</span>
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
        <div class="trenchbot-legend-icon">🔫</div>
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
  
  // Add the bubble map to the document
  document.body.appendChild(bubbleMap);
  
  // Get the bubbles container
  const bubblesContainer = bubbleMap.querySelector('.trenchbot-bubbles-container');
  
  // Make the bubble map draggable
  makeOverlayDraggable(bubbleMap, '.trenchbot-bubble-map-title');
  
  // Add event listeners
  document.getElementById('bubble-map-close').addEventListener('click', () => {
    bubbleMap.remove();
    bubbleMapVisible = false;
  });
  
  // Add listeners for filters
  const viewFilters = bubbleMap.querySelectorAll('input[name="view-filter"]');
  viewFilters.forEach(filter => {
    filter.addEventListener('change', () => {
      renderBubbles(bubblesContainer);
    });
  });
  
  const typeFilter = bubbleMap.querySelector('#wallet-type-filter');
  if (typeFilter) {
    typeFilter.addEventListener('change', () => {
      renderBubbles(bubblesContainer);
    });
  }
  
  // Add bubble map styles
  addBubbleMapStyles();
  
  // Initial render of bubbles
  renderBubbles(bubblesContainer);
}

// Render the bubbles based on current filter settings
function renderBubbles(container) {
  // Clear existing bubbles
  container.innerHTML = '';
  
  // Get filter settings
  const showOnlyHolding = document.querySelector('input[name="view-filter"][value="holding"]').checked;
  const selectedType = document.querySelector('#wallet-type-filter').value;
  
  // Check if we have the data we need
  if (!fullBundleData || !fullBundleData.bundles) {
    const noData = document.createElement('div');
    noData.className = 'trenchbot-no-data-message';
    noData.textContent = 'No bundle data available';
    container.appendChild(noData);
    return;
  }
  
  // Create bubbles based on bundle data
  const bundles = Object.entries(fullBundleData.bundles).map(([id, bundle]) => {
    return {
      id,
      ...bundle
    };
  });
  
  // Sort bundles by size (percentage) in descending order
  bundles.sort((a, b) => b.token_percentage - a.token_percentage);
  
  // Set up the physics simulation for bubbles
  setupPhysicsSimulation(container, bundles, showOnlyHolding, selectedType);
}

// Set up a simple physics simulation for the bubbles
function setupPhysicsSimulation(container, bundles, showOnlyHolding, selectedType) {
  // Filter bundles based on criteria
  const filteredBundles = bundles.filter(bundle => {
    // Skip if we're only showing holding wallets and this one has no holdings
    if (showOnlyHolding && bundle.holding_amount <= 0) {
      return false;
    }
    
    // Check if wallet type matches filter
    if (selectedType !== 'all') {
      const hasMatchingWallet = Object.values(bundle.wallet_categories || {}).some(
        category => category === selectedType
      );
      
      if (!hasMatchingWallet) {
        return false;
      }
    }
    
    return true;
  });
  
  // If no bubbles match filters, show message
  if (filteredBundles.length === 0) {
    const noData = document.createElement('div');
    noData.className = 'trenchbot-no-data-message';
    noData.textContent = 'No bundles match the current filters';
    container.appendChild(noData);
    return;
  }
  
  // Create bubbles with physics properties
  const bubbles = [];
  
  // Create DOM elements for bubbles
  filteredBundles.forEach((bundle, index) => {
    // Create the bubble element
    const bubble = document.createElement('div');
    bubble.className = 'trenchbot-bubble';
    bubble.setAttribute('data-bundle-id', bundle.id);
    
    // Size based on percentage (scaled for visibility)
    const size = calculateBubbleSize(bundle.token_percentage);
    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;
    
    // Position randomly initially
    const containerRect = container.getBoundingClientRect();
    const maxX = containerRect.width - size;
    const maxY = containerRect.height - size;
    const x = Math.random() * maxX;
    const y = Math.random() * maxY;
    
    bubble.style.left = `${x}px`;
    bubble.style.top = `${y}px`;
    
    // Color based on holding status
    if (bundle.holding_amount > 0) {
      bubble.classList.add('trenchbot-holding');
    } else {
      bubble.classList.add('trenchbot-sold');
    }
    
    // Get the primary wallet category for this bundle
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
    
    // Set category-specific emoji
    let icon = '👤'; // Default
    switch (primaryCategory) {
      case 'sniper':
        icon = '🔫';
        break;
      case 'regular':
        icon = '👤';
        break;
      case 'new_wallet':
        icon = '🆕';
        break;
      case 'copy_trader':
        icon = '🔄';
        break;
      case 'team_bundle':
        icon = '👨‍💻';
        break;
    }
    
    // Add content to the bubble
    bubble.innerHTML = `
      <div class="trenchbot-bubble-content">
        <div class="trenchbot-bubble-icon">${icon}</div>
        <div class="trenchbot-bubble-percentage">${bundle.token_percentage.toFixed(2)}%</div>
      </div>
    `;
    
    // Create tooltip content
    const tooltipContent = `
      <div class="trenchbot-tooltip-content">
        <div class="trenchbot-tooltip-header">Bundle Info</div>
        <div class="trenchbot-tooltip-row">
          <span class="trenchbot-tooltip-label">Token %:</span>
          <span class="trenchbot-tooltip-value">${bundle.token_percentage.toFixed(2)}%</span>
        </div>
        <div class="trenchbot-tooltip-row">
          <span class="trenchbot-tooltip-label">Holding %:</span>
          <span class="trenchbot-tooltip-value">${bundle.holding_percentage ? bundle.holding_percentage.toFixed(2) : '0.00'}%</span>
        </div>
        <div class="trenchbot-tooltip-row">
          <span class="trenchbot-tooltip-label">SOL:</span>
          <span class="trenchbot-tooltip-value">${bundle.total_sol ? bundle.total_sol.toFixed(2) : '0.00'}</span>
        </div>
        <div class="trenchbot-tooltip-row">
          <span class="trenchbot-tooltip-label">Wallets:</span>
          <span class="trenchbot-tooltip-value">${bundle.unique_wallets || 0}</span>
        </div>
        <div class="trenchbot-tooltip-row">
          <span class="trenchbot-tooltip-label">Type:</span>
          <span class="trenchbot-tooltip-value">${primaryCategory.replace(/_/g, ' ')}</span>
        </div>
      </div>
    `;
    
    // Add tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'trenchbot-bubble-tooltip';
    tooltip.innerHTML = tooltipContent;
    bubble.appendChild(tooltip);
    
    // Add physics properties
    const physics = {
      x,
      y,
      vx: (Math.random() - 0.5) * 0.5, // Random initial velocity
      vy: (Math.random() - 0.5) * 0.5,
      radius: size / 2,
      element: bubble,
      bundle
    };
    
    bubbles.push(physics);
    
    // Add animation delay for staggered appearance
    bubble.style.animationDelay = `${index * 30}ms`;
    
    // Add the bubble to the container
    container.appendChild(bubble);
    
    // Add event listeners
    bubble.addEventListener('mouseover', () => {
      tooltip.style.display = 'block';
      bubble.classList.add('trenchbot-bubble-hover');
    });
    
    bubble.addEventListener('mouseout', () => {
      tooltip.style.display = 'none';
      bubble.classList.remove('trenchbot-bubble-hover');
    });
    
    bubble.addEventListener('click', () => {
      showBundleDetails(bundle);
    });
    
    // Make bubbles draggable
    makeBubbleDraggable(bubble, physics);
  });
  
  // Run the physics simulation
  let animationFrame;
  const update = () => {
    // Update positions
    bubbles.forEach(bubble => {
      if (bubble.dragging) return; // Skip physics for bubbles being dragged
      
      // Apply forces and update position
      bubble.x += bubble.vx;
      bubble.y += bubble.vy;
      
      // Dampen velocity (friction)
      bubble.vx *= 0.99;
      bubble.vy *= 0.99;
      
      // Container bounds
      const containerRect = container.getBoundingClientRect();
      if (bubble.x - bubble.radius < 0) {
        bubble.x = bubble.radius;
        bubble.vx *= -0.7; // Bounce and lose energy
      } else if (bubble.x + bubble.radius > containerRect.width) {
        bubble.x = containerRect.width - bubble.radius;
        bubble.vx *= -0.7;
      }
      
      if (bubble.y - bubble.radius < 0) {
        bubble.y = bubble.radius;
        bubble.vy *= -0.7;
      } else if (bubble.y + bubble.radius > containerRect.height) {
        bubble.y = containerRect.height - bubble.radius;
        bubble.vy *= -0.7;
      }
      
      // Apply the position to the DOM element
      bubble.element.style.left = `${bubble.x - bubble.radius}px`;
      bubble.element.style.top = `${bubble.y - bubble.radius}px`;
    });
    
    // Handle collisions between bubbles
    for (let i = 0; i < bubbles.length; i++) {
      for (let j = i + 1; j < bubbles.length; j++) {
        const b1 = bubbles[i];
        const b2 = bubbles[j];
        
        // Skip if either bubble is being dragged
        if (b1.dragging || b2.dragging) continue;
        
        const dx = b1.x - b2.x;
        const dy = b1.y - b2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = b1.radius + b2.radius;
        
        // If bubbles are overlapping, apply repulsion
        if (distance < minDistance) {
          const angle = Math.atan2(dy, dx);
          const overlap = minDistance - distance;
          
          // Normalized overlap vector
          const moveX = Math.cos(angle) * overlap * 0.5;
          const moveY = Math.sin(angle) * overlap * 0.5;
          
          // Move bubbles apart slightly based on their relative sizes
          const m1 = b1.radius * b1.radius;
          const m2 = b2.radius * b2.radius;
          const totalMass = m1 + m2;
          
          // Move proportionally to mass (bigger bubbles move less)
          if (!b1.dragging) {
            b1.x += moveX * (m2 / totalMass);
            b1.y += moveY * (m2 / totalMass);
          }
          
          if (!b2.dragging) {
            b2.x -= moveX * (m1 / totalMass);
            b2.y -= moveY * (m1 / totalMass);
          }
          
          // Add a bit of energy to the system
          const forceFactor = 0.05;
          b1.vx += forceFactor * moveX * (m2 / totalMass);
          b1.vy += forceFactor * moveY * (m2 / totalMass);
          b2.vx -= forceFactor * moveX * (m1 / totalMass);
          b2.vy -= forceFactor * moveY * (m1 / totalMass);
        }
      }
    }
    
    // Continue the animation loop
    animationFrame = requestAnimationFrame(update);
  };
  
  // Start the animation
  update();
  
  // Stop the physics when the bubble map is closed
  const bubbleMap = document.getElementById('trenchbot-bubble-map');
  if (bubbleMap) {
    const closeButton = bubbleMap.querySelector('#bubble-map-close');
    if (closeButton) {
      const originalHandler = closeButton.onclick;
      closeButton.onclick = () => {
        cancelAnimationFrame(animationFrame);
        if (originalHandler) originalHandler();
      };
    }
  }
  
  // Also stop on window unload
  window.addEventListener('beforeunload', () => {
    cancelAnimationFrame(animationFrame);
  });
}

// Make a bubble draggable
function makeBubbleDraggable(bubble, physics) {
  let isDragging = false;
  let offsetX, offsetY;
  
  bubble.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isDragging = true;
    physics.dragging = true;
    
    // Calculate offset from bubble center
    const rect = bubble.getBoundingClientRect();
    offsetX = e.clientX - (rect.left + rect.width / 2);
    offsetY = e.clientY - (rect.top + rect.height / 2);
    
    // Bring to front
    bubble.style.zIndex = '10';
    
    const onMouseMove = (e) => {
      if (isDragging) {
        const containerRect = bubble.parentElement.getBoundingClientRect();
        const parentRect = bubble.parentElement.getBoundingClientRect();
        
        // Calculate position relative to container, accounting for scroll
        const x = e.clientX - parentRect.left - offsetX;
        const y = e.clientY - parentRect.top - offsetY;
        
        // Ensure the bubble stays within the container
        const radius = physics.radius;
        const boundedX = Math.max(radius, Math.min(x, containerRect.width - radius));
        const boundedY = Math.max(radius, Math.min(y, containerRect.height - radius));
        
        // Update physics position
        physics.x = boundedX;
        physics.y = boundedY;
        
        // Update DOM position
        bubble.style.left = `${boundedX - radius}px`;
        bubble.style.top = `${boundedY - radius}px`;
      }
    };
    
    const onMouseUp = () => {
      isDragging = false;
      physics.dragging = false;
      bubble.style.zIndex = '';
      
      // Reset velocity after drag ends
      physics.vx = 0;
      physics.vy = 0;
      
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
}

// Calculate bubble size based on percentage
function calculateBubbleSize(percentage) {
  // Min size: 40px, Max size: 140px
  // Scale the size logarithmically for better visibility of smaller bubbles
  const minSize = 40;
  const maxSize = 140;
  
  if (percentage <= 0) return minSize;
  
  // Logarithmic scale to make smaller bubbles more visible
  const logValue = Math.log(percentage + 1) / Math.log(100);
  return minSize + (maxSize - minSize) * logValue;
}

// Show detailed information about a specific bundle
function showBundleDetails(bundle) {
  // Remove existing details panel if any
  const existingPanel = document.getElementById('trenchbot-bundle-details-panel');
  if (existingPanel) {
    existingPanel.remove();
  }
  
  // Create details panel
  const detailsPanel = document.createElement('div');
  detailsPanel.id = 'trenchbot-bundle-details-panel';
  detailsPanel.className = 'trenchbot-bundle-details-panel';
  
  // Get bundle wallet categories
  let walletCategories = {};
  if (bundle.bundle_analysis && bundle.bundle_analysis.category_breakdown) {
    walletCategories = bundle.bundle_analysis.category_breakdown;
  }
  
  // Prepare wallet categories breakdown
  const categoryList = Object.entries(walletCategories)
    .map(([category, count]) => `<div class="trenchbot-detail-row"><span>${category.replace(/_/g, ' ')}</span><span>${count}</span></div>`)
    .join('');
  
  // Prepare wallet list
  const walletList = Object.entries(bundle.wallet_info || {})
    .map(([wallet, info]) => {
      const shortWallet = wallet.substring(0, 6) + '...' + wallet.substring(wallet.length - 4);
      return `
        <div class="trenchbot-wallet-item">
          <div class="trenchbot-wallet-address" title="${wallet}">${shortWallet}</div>
          <div class="trenchbot-wallet-stats">
            <span>${info.sol_percentage ? info.sol_percentage.toFixed(1) : '0.0'}% SOL</span>
            <span>${info.token_percentage ? info.token_percentage.toFixed(1) : '0.0'}% Token</span>
          </div>
        </div>
      `;
    })
    .join('');
  
  // Build the panel content
  detailsPanel.innerHTML = `
    <div class="trenchbot-details-header">
      <h3>Bundle Details (${bundle.unique_wallets || 0} wallets)</h3>
      <button id="trenchbot-close-details" class="trenchbot-close-button">&times;</button>
    </div>
    <div class="trenchbot-details-content">
      <div class="trenchbot-details-section">
        <h4>Overview</h4>
        <div class="trenchbot-detail-row">
          <span>Token Percentage:</span>
          <span>${bundle.token_percentage ? bundle.token_percentage.toFixed(2) : '0.00'}%</span>
        </div>
        <div class="trenchbot-detail-row">
          <span>Holding Percentage:</span>
          <span>${bundle.holding_percentage ? bundle.holding_percentage.toFixed(2) : '0.00'}%</span>
        </div>
        <div class="trenchbot-detail-row">
          <span>Total SOL:</span>
          <span>${bundle.total_sol ? bundle.total_sol.toFixed(2) : '0.00'} SOL</span>
        </div>
        <div class="trenchbot-detail-row">
          <span>Holding Status:</span>
          <span>${bundle.holding_amount > 0 ? 'Yes' : 'No'}</span>
        </div>
      </div>
      
      <div class="trenchbot-details-section">
        <h4>Wallet Categories</h4>
        <div class="trenchbot-category-list">
          ${categoryList || '<div class="trenchbot-no-data">No category data available</div>'}
        </div>
      </div>
      
      <div class="trenchbot-details-section">
        <h4>Wallets</h4>
        <div class="trenchbot-wallets-list">
          ${walletList || '<div class="trenchbot-no-data">No wallet data available</div>'}
        </div>
      </div>
    </div>
  `;
  
  // Add the panel to the bubble map
  const bubbleMap = document.getElementById('trenchbot-bubble-map');
  if (bubbleMap) {
    bubbleMap.appendChild(detailsPanel);
    
    // Add close button event listener
    const closeButton = document.getElementById('trenchbot-close-details');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        detailsPanel.remove();
      });
    }
    
    // Make the panel draggable
    makeOverlayDraggable(detailsPanel, '.trenchbot-details-header');
  }
}

// Replace the existing makeOverlayDraggable function with this version
function makeOverlayDraggable(element, handleSelector = null) {
  if (!element) return;
  
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  
  // Find element to use as drag handle
  const dragHandle = handleSelector ? element.querySelector(handleSelector) : element;
  
  if (!dragHandle) return;
  
  dragHandle.style.cursor = 'move';
  
  dragHandle.addEventListener('mousedown', function(e) {
    // Don't start drag if clicking on a button or interactive element
    if (e.target.tagName.toLowerCase() === 'button' || 
        e.target.id === 'trenchbot-close' || 
        e.target.id === 'trenchbot-refresh' ||
        e.target.id === 'trenchbot-more-info') {
      return;
    }
    
    e.preventDefault();
    
    // Get the mouse cursor position at startup
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    document.addEventListener('mousemove', elementDrag);
    document.addEventListener('mouseup', closeDragElement);
  });
  
  function elementDrag(e) {
    e.preventDefault();
    
    // Calculate the new cursor position
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    // Set the element's new position directly (this is the critical part)
    element.style.top = (element.offsetTop - pos2) + "px";
    element.style.left = (element.offsetLeft - pos1) + "px";
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
      z-index: 9999;
      background-color: #121212;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      user-select: none;
      transition: all 0.2s ease;
      border: 1px solid rgba(255, 255, 255, 0.1);
      width: 220px;
      cursor: move;
    }
    
    .trenchbot-content {
      padding: 10px;
    }
    
    .trenchbot-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 5px;
      font-size: 16px;
      font-weight: 600;
    }
    
    .trenchbot-percentage {
      font-size: 15px;
      font-weight: 700;
    }
    
    .trenchbot-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.7);
    }
    
    .trenchbot-label {
      font-size: 12px;
    }
    
    .trenchbot-green {
      color: #00e676;
    }
    
    .trenchbot-red {
      color: #ff4444;
    }
    
    .trenchbot-yellow {
      color: #ffaa00;
    }
    
    .trenchbot-error {
      color: #ff4444;
    }
    
    .trenchbot-close-button {
      position: absolute;
      top: 5px;
      right: 5px;
      font-size: 18px;
      color: rgba(255, 255, 255, 0.7);
      background: none;
      border: none;
      cursor: pointer !important;
      padding: 0;
      width: 20px;
      height: 20px;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
    }
    
    .trenchbot-close-button:hover {
      color: white;
    }
    
    .trenchbot-refresh-button {
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
    
    .trenchbot-refresh-button:hover {
      opacity: 0.8;
    }
    
    .trenchbot-refreshing {
      animation: trenchbot-spin 1s linear infinite;
    }
    
    .trenchbot-more-info-button {
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      color: #2196F3;
      font-size: 12px;
      text-decoration: underline;
    }
    
    .trenchbot-more-info-button:hover {
      color: #64b5f6;
    }
    
    @keyframes trenchbot-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;
  
  document.head.appendChild(styles);
}

// Add styles for the bubble map
function addBubbleMapStyles() {
  if (document.getElementById('trenchbot-bubble-map-styles')) return;
  
  const styles = document.createElement('style');
  styles.id = 'trenchbot-bubble-map-styles';
  styles.textContent = `
    .trenchbot-bubble-map {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 800px;
      height: 600px;
      max-width: 90vw;
      max-height: 80vh;
      background-color: #121212;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.1);
      overflow: hidden;
      animation: trenchbot-fade-in 0.3s ease-out;
    }
    
    .trenchbot-bubble-map-header {
      padding: 15px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      background-color: #1a1a1a;
    }
    
    .trenchbot-bubble-map-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    
    .trenchbot-bubble-map-ticker {
      display: flex;
      align-items: center;
      font-size: 16px;
      font-weight: 600;
    }
    
    .trenchbot-bubble-map-stats {
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
      margin-bottom: 12px;
    }
    
    .trenchbot-stat-item {
      display: flex;
      flex-direction: column;
      font-size: 12px;
    }
    
    .trenchbot-stat-label {
      color: rgba(255, 255, 255, 0.7);
    }
    
    .trenchbot-stat-value {
      font-weight: 600;
      font-size: 14px;
    }
    
    .trenchbot-bubble-map-filters {
      display: flex;
      gap: 20px;
      align-items: center;
    }
    
    .trenchbot-filter-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .trenchbot-filter-group-label {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.7);
    }
    
    .trenchbot-filter-option {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      cursor: pointer;
    }
    
    .trenchbot-select {
      background-color: #2a2a2a;
      color: #fff;
      border: 1px solid #444;
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 12px;
      cursor: pointer;
    }
    
    .trenchbot-bubbles-container {
      flex: 1;
      position: relative;
      overflow: hidden;
      background-color: #0a0a0a;
    }
    
    .trenchbot-bubble {
      position: absolute;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      animation: trenchbot-bubble-pop 0.5s ease-out;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
      opacity: 0.9;
    }
    
    .trenchbot-bubble.trenchbot-holding {
      background: rgba(255, 68, 68, 0.7);
      border: 2px solid rgba(255, 68, 68, 0.9);
    }
    
    .trenchbot-bubble.trenchbot-sold {
      background: rgba(130, 130, 140, 0.4);
      border: 2px solid rgba(130, 130, 140, 0.7);
    }
    
    .trenchbot-bubble:hover, .trenchbot-bubble-hover {
      transform: scale(1.05);
      z-index: 2;
      opacity: 1;
    }
    
    .trenchbot-bubble-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4px;
      color: white;
      text-align: center;
      pointer-events: none; /* Allow clicks to pass through to the bubble itself */
    }
    
    .trenchbot-bubble-icon {
      font-size: 18px;
      margin-bottom: 3px;
    }
    
    .trenchbot-bubble-percentage {
      font-size: 12px;
      font-weight: 600;
    }
    
    .trenchbot-bubble-tooltip {
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 8px;
      border-radius: 4px;
      font-size: 12px;
      pointer-events: none;
      white-space: nowrap;
      display: none;
      z-index: 3;
      border: 1px solid rgba(255, 255, 255, 0.2);
      min-width: 180px;
    }
    
    .trenchbot-tooltip-content {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    
    .trenchbot-tooltip-header {
      font-weight: 600;
      margin-bottom: 4px;
      text-align: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      padding-bottom: 4px;
    }
    
    .trenchbot-tooltip-row {
      display: flex;
      justify-content: space-between;
      gap: 10px;
    }
    
    .trenchbot-tooltip-label {
      color: rgba(255, 255, 255, 0.7);
    }
    
    .trenchbot-tooltip-value {
      font-weight: 600;
    }
    
    .trenchbot-no-data-message {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: rgba(255, 255, 255, 0.5);
      font-size: 16px;
      text-align: center;
    }
    
    .trenchbot-bubble-map-legend {
      display: flex;
      gap: 15px;
      padding: 10px 15px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      background-color: #1a1a1a;
      flex-wrap: wrap;
      justify-content: center;
    }
    
    .trenchbot-legend-item {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 12px;
    }
    
    .trenchbot-legend-color {
      width: 14px;
      height: 14px;
      border-radius: 50%;
    }
    
    .trenchbot-legend-holding {
      background: rgba(255, 68, 68, 0.7);
      border: 1px solid rgba(255, 68, 68, 0.9);
    }
    
    .trenchbot-legend-sold {
      background: rgba(130, 130, 140, 0.4);
      border: 1px solid rgba(130, 130, 140, 0.7);
    }
    
    .trenchbot-legend-icon {
      font-size: 14px;
    }
    
    .trenchbot-bundle-details-panel {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      max-height: 60%;
      background-color: #1a1a1a;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 0 0 8px 8px;
      overflow: hidden;
      animation: trenchbot-slide-up 0.3s ease-out;
      z-index: 2;
    }
    
    .trenchbot-details-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 15px;
      background-color: #222;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      position: relative;
    }
    
    .trenchbot-details-header h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
    }
    
    .trenchbot-details-content {
      padding: 15px;
      overflow-y: auto;
      max-height: calc(100% - 40px);
    }
    
    .trenchbot-details-section {
      margin-bottom: 16px;
    }
    
    .trenchbot-details-section h4 {
      margin: 0 0 8px 0;
      font-size: 13px;
      color: rgba(255, 255, 255, 0.9);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding-bottom: 5px;
    }
    
    .trenchbot-detail-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
      font-size: 12px;
    }
    
    .trenchbot-category-list {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    
    .trenchbot-no-data {
      color: rgba(255, 255, 255, 0.5);
      font-style: italic;
      font-size: 12px;
    }
    
    .trenchbot-wallets-list {
      max-height: 200px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    
    .trenchbot-wallet-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      font-size: 12px;
    }
    
    .trenchbot-wallet-address {
      font-family: monospace;
      color: rgba(255, 255, 255, 0.8);
    }
    
    .trenchbot-wallet-stats {
      display: flex;
      gap: 10px;
    }
    
    @keyframes trenchbot-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes trenchbot-bubble-pop {
      0% { transform: scale(0); opacity: 0; }
      70% { transform: scale(1.1); }
      100% { transform: scale(1); opacity: 0.9; }
    }
    
    @keyframes trenchbot-slide-up {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }
  `;
  
  document.head.appendChild(styles);
}

// Initialize the extension
init();