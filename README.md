# Axiom TrenchBot Bundle Info Chrome Extension

This Chrome extension enhances the Axiom Trading Platform by displaying detailed bundle information from the TrenchBot API when viewing tokens, including a powerful bubble map visualization of token distribution.

![Extension Screenshot](screenshots/extension_demo.png)

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
  - Efficient data loading to minimize browser impact
  - Smart detection of page changes
  - Automatic removal of overlay when navigating away from token pages

## Installation

### From Chrome Web Store (Coming Soon)
1. Visit the Chrome Web Store
2. Search for "Axiom TrenchBot Bundle Info" or use the direct link
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
- **Wallet Details**: See exact percentages, SOL amounts, and wallet addresses

### Controls
- **Enable/Disable**: Toggle the extension on/off from the popup or by clicking the extension icon
- **Refresh Data**: Update the bundle information manually
- **Close/Reopen**: Close overlays using the X button, reload the page to make them reappear

## Troubleshooting

If you encounter issues:

- **Overlay doesn't appear**: Ensure the extension is enabled in the popup
- **Data seems outdated**: Use the refresh button in the overlay or popup
- **Extension conflicts**: Try disabling other extensions temporarily
- **Performance issues**: Disable and re-enable the extension if the page becomes slow

## Privacy and Permissions

This extension requires the following permissions:
- Access to axiom.trade (to integrate with the trading platform)
- Access to dexscreener.com (to fetch token information)
- Access to trench.bot (to fetch bundle information)
- Storage (to save your preferences)

The extension does not collect or store any personal data.

## Development

### Project Structure
```
├── manifest.json        # Extension configuration
├── background.js        # Background service worker
├── content.js           # Main content script
├── popup.html           # Extension popup
├── popup.js             # Popup functionality
├── popup.css            # Popup styles
├── images/              # Extension icons
└── icon_generator.html  # Tool to generate icons
```

### Building From Source
1. Clone this repository
2. Make any desired modifications
3. Load the extension in Developer Mode (see Installation)

## Credits
- Bundle data provided by [TrenchBot](https://trench.bot/)
- Token information from [DexScreener](https://dexscreener.com/)
- Used with [Axiom Trading Platform](https://axiom.trade/)

## License
MIT License