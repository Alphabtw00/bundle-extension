// Background script for the Axiom TrenchBot Bundle Info extension

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
  });
  
  // Fetch data from DexScreener API
  async function fetchDexScreenerData(pairAddress) {
    try {
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
  
  // Log when the extension is installed
  chrome.runtime.onInstalled.addListener(() => {
    console.log('Axiom TrenchBot Bundle Info extension installed');
  });