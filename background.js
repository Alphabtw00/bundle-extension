// Add initial startup log
console.log('Background script started at:', new Date().toLocaleTimeString());

// Core caches and tracking
const apiCache = new Map();
const contractAddressCache = new Map();
const BUNDLE_CACHE_EXPIRY = 60 * 1000; // 60 seconds
const bundleRequestsInProgress = new Set(); // Prevent duplicate bundle calls
const pendingPairAddresses = new Set(); // Track pair addresses waiting for resolution
const pendingCallbacks = new Map(); // Track callbacks by pair address

// Set up web request listener for pair-info responses - runs continuously
chrome.webRequest.onCompleted.addListener(
  (details) => {
    console.log('Detected pair-info request:', details.url);
    
    // Only process successful GET requests
    if (details.method !== 'GET' || details.statusCode !== 200) return;
    
    try {
      const url = new URL(details.url);
      const pairAddress = url.searchParams.get('pairAddress');
      
      if (!pairAddress) return;
      
      // Skip if not waiting for this pair OR if bundle already in progress
      if (!pendingPairAddresses.has(pairAddress)) {
        console.log('Pair info request detected but not needed for:', pairAddress);
        return;
      }
      
      // Skip if bundle request already in progress
      if (bundleRequestsInProgress.has(pairAddress)) {
        console.log('Bundle request already in progress for:', pairAddress);
        return;
      }
      
      // Process the response immediately to speed things up
      fetch(details.url, { cache: 'no-store' }) // Disable caching to ensure fresh data
        .then(response => response.json())
        .then(data => {
          console.log('Pair-info response received for:', pairAddress);
          
          if (data.tokenAddress) {
            const tokenAddress = data.tokenAddress;
            const tokenName = data.tokenName || 'Token';
            const tokenSymbol = data.tokenTicker || '';
            
            console.log('Extracted token data from pair-info:', tokenAddress);
            
            // Check if we already have a valid contract address (from other sources)
            const existingEntry = contractAddressCache.get(pairAddress);
            if (existingEntry && existingEntry.address !== pairAddress) {
              console.log('Contract address already in cache, skipping pair-info update');
              return;
            }
            
            // Store in cache
            updateContractCache(pairAddress, tokenAddress, tokenName, tokenSymbol);
            
            // If we're waiting for this pair address, proceed with bundle fetch
            if (pendingPairAddresses.has(pairAddress)) {
              pendingPairAddresses.delete(pairAddress);
              processBundleRequest(tokenAddress, pairAddress, tokenName, tokenSymbol);
            }
          } else {
            console.log('No token address in pair-info for:', pairAddress);
          }
        })
        .catch(error => {
          console.error('Error processing pair-info:', error);
        });
    } catch (error) {
      console.error('Error with pair-info URL:', error);
    }
  },
  {urls: ["*://*.axiom.trade/pair-info*"]},
  ["responseHeaders"]
);

console.log('Pair-info listener initialized');

// Helper function to update contract cache
function updateContractCache(pairAddress, tokenAddress, tokenName, tokenSymbol) {
  // Store in cache with pair address as key
  contractAddressCache.set(pairAddress, {
    address: tokenAddress,
    name: tokenName,
    symbol: tokenSymbol
  });
  
  console.log('Updated contract cache:', pairAddress, '->', tokenAddress);
  
  // Also store with token address as key for direct lookups
  if (tokenAddress !== pairAddress) {
    contractAddressCache.set(tokenAddress, {
      address: tokenAddress,
      name: tokenName,
      symbol: tokenSymbol
    });
  }
}

// Process bundle request once we have a valid token address
function processBundleRequest(tokenAddress, pairAddress, tokenName, tokenSymbol) {
  // Skip if already in progress
  if (bundleRequestsInProgress.has(pairAddress) || bundleRequestsInProgress.has(tokenAddress)) {
    console.log('Bundle request already in progress, skipping');
    return;
  }
  
  // Mark as in progress to prevent duplicates
  bundleRequestsInProgress.add(pairAddress);
  if (tokenAddress !== pairAddress) {
    bundleRequestsInProgress.add(tokenAddress);
  }
  
  console.log('Starting bundle request for:', tokenAddress);
  
  // Fetch bundle data
  fetchBundleData(tokenAddress, pairAddress, tokenName, tokenSymbol);
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchTokenInfo') {
    fetchTokenInfo(request.tokenAddress, request.forceRefresh, sendResponse);
    return true; // Keep channel open
  }
});

// Main function to handle token info requests
function fetchTokenInfo(pairAddress, forceRefresh = false, callback) {
  console.log('fetchTokenInfo for:', pairAddress);
  
  // Check bundle cache first
  if (!forceRefresh) {
    const cachedData = apiCache.get(pairAddress);
    if (cachedData && (Date.now() - cachedData.timestamp < BUNDLE_CACHE_EXPIRY)) {
      console.log('Using cached bundle data for:', pairAddress);
      callback({ 
        success: true, 
        data: cachedData.data,
        cacheAge: Math.floor((Date.now() - cachedData.timestamp) / 1000)
      });
      return;
    }
  }
  
  // Skip if already in progress
  if (bundleRequestsInProgress.has(pairAddress)) {
    console.log('Bundle request already in progress for:', pairAddress);
    callback({ success: false, error: 'Request already in progress' });
    return;
  }
  
  // Store callback for this pair address
  if (callback) {
    pendingCallbacks.set(pairAddress, callback);
    
    // Set timeout to clean up if bundle request never completes
    setTimeout(() => {
      if (pendingCallbacks.has(pairAddress)) {
        console.log('Callback timed out for:', pairAddress);
        pendingCallbacks.delete(pairAddress);
        callback({ success: false, error: 'Request timed out' });
      }
    }, 15000);
  }
  
  // Check contract cache first
  const cachedContract = contractAddressCache.get(pairAddress);
  if (cachedContract) {
    console.log('Found in contract cache:', pairAddress, '->', cachedContract.address);
    // Use cached contract address
    processBundleRequest(cachedContract.address, pairAddress, cachedContract.name, cachedContract.symbol);
    return;
  }
  
  // Add to pending set
  pendingPairAddresses.add(pairAddress);
  
  // Sequential approach: First try DexScreener, then Moralis as fallback
  console.log('Starting DexScreener lookup for:', pairAddress);
  fetchDexScreenerData(pairAddress)
    .then(result => {
      console.log('DexScreener succeeded for:', pairAddress);
      
      // Store in cache
      updateContractCache(pairAddress, result.address, result.name, result.symbol);
      
      // Remove from pending
      pendingPairAddresses.delete(pairAddress);
      
      // Process bundle request
      processBundleRequest(result.address, pairAddress, result.name, result.symbol);
    })
    .catch(error => {
      console.log('DexScreener failed, trying Moralis for:', pairAddress);
      
      // Try Moralis as fallback
      fetchMoralisData(pairAddress)
        .then(result => {
          console.log('Moralis succeeded for:', pairAddress);
          
          // Store in cache
          updateContractCache(pairAddress, result.address, result.name, result.symbol);
          
          // Remove from pending
          pendingPairAddresses.delete(pairAddress);
          
          // Process bundle request
          processBundleRequest(result.address, pairAddress, result.name, result.symbol);
        })
        .catch(error => {
          console.log('Both DexScreener and Moralis failed for:', pairAddress);
          console.log('Waiting for pair-info response...');
          // Both APIs failed - we'll wait for pair-info response
          // The pair-info listener will handle it when the response comes in
        });
    });
}

// Fetch from DexScreener
async function fetchDexScreenerData(pairAddress) {
  console.log('Trying DexScreener for:', pairAddress);
  
  const response = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${pairAddress}`);
  if (!response.ok) throw new Error('DexScreener API error');
  
  const data = await response.json();
  if (!data?.pairs?.length) throw new Error('No pairs found');
  
  const baseToken = data.pairs[0].baseToken;
  return {
    address: baseToken.address,
    name: baseToken.name,
    symbol: baseToken.symbol
  };
}

// Fetch from Moralis
async function fetchMoralisData(pairAddress) {
  console.log('Trying Moralis for:', pairAddress);
  
  const response = await fetch(`https://solana-gateway.moralis.io/token/mainnet/pairs/${pairAddress}/stats`, {
    headers: { 'accept': 'application/json' }
  });
  
  if (!response.ok) throw new Error('Moralis API error');
  
  const data = await response.json();
  if (!data.tokenAddress) throw new Error('No token address found');
  
  return {
    address: data.tokenAddress,
    name: data.tokenName || 'Token',
    symbol: data.tokenSymbol || ''
  };
}

// Fetch bundle data from TrenchBot
async function fetchBundleData(tokenAddress, pairAddress, tokenName = 'Token', tokenSymbol = '') {
  console.log('Fetching bundle data for:', tokenAddress);
  
  try {
    const response = await fetch(`https://trench.bot/api/bundle/bundle_full/${tokenAddress}`);
    
    if (!response.ok) throw new Error(`TrenchBot API error: ${response.status}`);
    
    const bundleData = await response.json();
    
    // Process and format data
    const processedData = {
      tokenName,
      tokenSymbol,
      tokenAddress,
      totalPercentageBundled: bundleData.total_percentage_bundled || 0,
      totalHoldingPercentage: bundleData.total_holding_percentage || 0,
      totalBundles: bundleData.total_bundles || 0,
      totalSolSpent: bundleData.total_sol_spent || 0,
      bundles: bundleData.bundles || {},
      ticker: bundleData.ticker || tokenSymbol
    };
    
    // Store in cache
    apiCache.set(tokenAddress, {
      timestamp: Date.now(),
      data: processedData
    });
    
    // Store for pair address too if different
    if (pairAddress && pairAddress !== tokenAddress) {
      apiCache.set(pairAddress, {
        timestamp: Date.now(),
        data: processedData
      });
    }
    
    // Handle callback if one exists for this pair address
    if (pendingCallbacks.has(pairAddress)) {
      const callback = pendingCallbacks.get(pairAddress);
      pendingCallbacks.delete(pairAddress);
      callback({ success: true, data: processedData, cacheAge: 0 });
      console.log('Sent bundle data back to content script for:', pairAddress);
    }
    
    console.log('Bundle data successfully fetched for:', tokenAddress);
  } catch (error) {
    console.error('Bundle API error:', error);
    
    // Handle callback error
    if (pendingCallbacks.has(pairAddress)) {
      const callback = pendingCallbacks.get(pairAddress);
      pendingCallbacks.delete(pairAddress);
      callback({ success: false, error: error.message });
      console.log('Sent error back to content script for:', pairAddress);
    }
  } finally {
    // Remove from in-progress tracking
    bundleRequestsInProgress.delete(tokenAddress);
    if (pairAddress) bundleRequestsInProgress.delete(pairAddress);
  }
}

// Clean up expired cache entries
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of apiCache.entries()) {
    if (now - value.timestamp > BUNDLE_CACHE_EXPIRY) {
      apiCache.delete(key);
    }
  }
}, 90000);

console.log('Background script initialized');
