# Axiom Bundle Info Chrome Extension

This Chrome extension enhances the Axiom Trading Platform by displaying detailed bundle information from a specialized Bundle API when viewing tokens, including a powerful bubble map visualization of token distribution.

![Extension Screenshot](images/screenshot.png)

## Features

- **Real-time Bundle Information**: Automatically displays key bundle stats when viewing tokens on Axiom
  - Bundle percentage
  - Holding percentage
  - Number of bundles
  - Total SOL spent

- **Interactive Bubble Map**: Visualize token distribution with a detailed bubble map
  - Filter by wallet type (sniper, regular, new wallet, etc.)
  - Toggle between showing all wallets or only those holding
  - Interactive bubbles with detailed information on click

- **User-Friendly Interface**:
  - Draggable overlays that won't cover important content
  - Enable/disable functionality with one click
  - Easy refresh button to update data

- **Performance Optimized**:
  - Efficient data caching to minimize API calls
  - Smart detection of page changes
  - Automatic removal of overlay when navigating away from token pages

## Installation

### From Chrome Web Store (Coming Soon)
1. Visit the Chrome Web Store
2. Search for "Axiom Bundle Info" or use the direct link
3. Click "Add to Chrome"
4. Confirm the installation

### Manual Installation (Developer Mode)
1. Download this repository (ZIP) or clone it
2. Unzip if needed
3. Open Chrome and go to `chrome://extensions/`
4. Enable "Developer mode" using the toggle in the top-right
5. Click "Load unpacked" and select the extension directory
6. The extension is now installed and ready to use

## Usage

### Basic Usage
1. Navigate to [Axiom Trading Platform](https://axiom.trade/)
2. Open any token/meme page
3. The bundle information overlay will automatically appear
4. Click "More Info" to open the detailed bubble map visualization

### Bubble Map Features
- **Filter by Type**: Use the dropdown to focus on specific wallet types
- **View Options**: Choose to show only holding wallets or all wallets
- **Interactive Bubbles**: Click on any bubble for detailed information
- **Bubble Visualization**: Colors and sizes indicate wallet types and holding percentages
- **Wallet Details**: See exact percentages, SOL amounts, and wallet addresses

### Controls
- **Enable/Disable**: Toggle the extension on/off from the popup or by clicking the extension icon
- **Refresh Data**: Update the bundle information manually (5-second cooldown between refreshes)
- **Close/Reopen**: Close overlays using the X button, reload the page to make them reappear

## Technical Details

The extension uses a combination of techniques to deliver a seamless experience:

- **D3.js Visualization**: Interactive force-directed graph for the bubble map
- **Caching System**: Smart caching with configurable expiry times
- **Multiple Data Sources**: Fallback mechanisms for contract address resolution
- **Dynamic UI**: Glass-morphism design that adapts to different token contexts

## Troubleshooting

If you encounter issues:

- **Overlay doesn't appear**: Ensure the extension is enabled in the popup
- **Data seems outdated**: Use the refresh button in the overlay or popup
- **Extension conflicts**: Try disabling other extensions temporarily
- **Performance issues**: Disable and re-enable the extension if the page becomes slow

## Privacy and Permissions

This extension requires the following permissions:
- Access to axiom.trade (to integrate with the trading platform)
- Access to API endpoints (to fetch token and bundle information)
- Storage (to save your preferences and cache data)

The extension does not collect or store any personal data. All data is stored locally in your browser.

## Development

### Project Structure
```
├── manifest.json        # Extension configuration
├── background.js        # Background service worker with API caching
├── content.js           # Main content script with D3 visualizations
├── popup.html           # Extension popup
├── popup.js             # Popup functionality
├── styles.css           # Main extension styles
├── images/              # Extension icons
└── icon_generator.html  # Tool to generate icons
```

### Key Components
- **Background Script**: Handles API requests and maintains the cache
- **Content Script**: Injects the UI and visualization into Axiom pages
- **D3 Visualization**: Creates the interactive bubble map
- **Popup Interface**: Allows users to control the extension behavior

### Building From Source
1. Clone this repository
2. Make any desired modifications
3. Load the extension in Developer Mode (see Installation)

## License
MIT License
