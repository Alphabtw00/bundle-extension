# Axiom TrenchBot Bundle Info Chrome Extension

This Chrome extension enhances the Axiom Trading Platform by displaying additional bundle information from the TrenchBot API when viewing tokens.

## Features

- Automatically detects when you're viewing a token on Axiom
- Fetches bundle information from the TrenchBot API
- Displays bundle info including:
  - Total bundles
  - Holding amount
  - Percentage bundled
  - Total SOL spent
- Seamlessly integrates with Axiom's interface

## Installation

### Method 1: Loading the unpacked extension (for development)

1. Download or clone this repository to your local machine
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" by toggling the switch in the top-right corner
4. Click "Load unpacked" and select the directory containing the extension files
5. The extension should now be installed and active

### Method 2: Installing from the Chrome Web Store (coming soon)

1. Visit the Chrome Web Store page for Axiom TrenchBot Bundle Info
2. Click "Add to Chrome"
3. Confirm the installation when prompted
4. The extension will be automatically installed and ready to use

## Usage

1. Navigate to [Axiom Trading Platform](https://axiom.trade/)
2. Browse to any token/meme page (URL will contain `/meme/` or `/token/` followed by an address)
3. The bundle information will automatically appear in the token info section
4. If you need to refresh the data, click on the extension icon and press the "Refresh" button

## How It Works

1. The extension monitors the URL of the Axiom Trading Platform
2. When a token page is detected, it extracts the pair address from the URL
3. It uses the DexScreener API to get the actual token contract address
4. It then queries the TrenchBot API to fetch bundle information for that token
5. The data is displayed in a panel that matches Axiom's interface design

## Troubleshooting

If the bundle information doesn't appear:
- Make sure you're on a token/meme page (the URL should contain `/meme/` or `/token/`)
- Check if the token is supported by TrenchBot (not all tokens have bundle data)
- Click the extension icon and press the "Refresh" button
- Try refreshing the page

## Privacy and Permissions

This extension requires the following permissions:
- Access to axiom.trade (to integrate with the trading platform)
- Access to dexscreener.com (to fetch token information)
- Access to trench.bot (to fetch bundle information)

The extension does not collect or store any personal data.

## Credits

- Bundle data provided by [TrenchBot](https://trench.bot/)
- Token information from [DexScreener](https://dexscreener.com/)

## License

MIT License