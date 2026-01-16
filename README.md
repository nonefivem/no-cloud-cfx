<div align="center">
  <img src="https://assets.nonefivem.com/logo/dark-bg.png" alt="NoneM Logo" width="200" />
  
  # NoCloud FiveM SDK
  
  **Serverless storage and screenshot capture for FiveM**
  
  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Bun](https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh/)
  [![FiveM](https://img.shields.io/badge/FiveM-F40552?style=for-the-badge&logo=fivem&logoColor=white)](https://fivem.net/)
</div>

---

## Overview

NoCloud FiveM SDK provides seamless integration with the NoCloud platform, enabling FiveM servers to capture and upload in-game screenshots directly to cloud storage.

### Features

- 📸 **Native Screenshot Capture** - Uses `@citizenfx/three` and `CfxTexture` for direct game view capture
- ☁️ **Cloud Storage** - Upload screenshots directly to NoCloud's serverless storage
- 🔒 **Signed URLs** - Secure uploads with pre-signed URLs
- ⚡ **Zero Dependencies** - Self-contained, no external resources required
- 🛠️ **TypeScript First** - Full type safety across client, server, and NUI

## Installation

### Option 1: Download Release (Recommended)

Download the latest release from [GitHub Releases](https://github.com/NoneM/no-cloud-cfx/releases):

- **`no-cloud-cfx-v*.zip`** - Production build (minified)
- **`no-cloud-cfx-v*-dev.zip`** - Development build (non-minified, with sourcemaps)

Extract to your `resources` folder and add to your `server.cfg`:

```cfg
ensure no-cloud-cfx
```

### Option 2: Build from Source

```bash
# Clone the repository
git clone https://github.com/NoneM/no-cloud-cfx.git
cd no-cloud-cfx

# Install dependencies
bun install

# Build
bun run build
```

## Building

```bash
# Production build (minified, external sourcemaps)
bun run build

# Development build (no minify, inline sourcemaps)
bun run build --no-minify --sourcemap=inline

# No sourcemaps
bun run build --sourcemap=none
```

### Build Output

```
dist/
├── client.js       # FiveM client script
├── server.js       # FiveM server script
└── web/
    ├── index.html  # NUI page
    ├── index.js    # NUI script
    └── index.css   # NUI styles
```

## Usage

### Taking a Screenshot

```lua
-- From any client-side script
local result = exports['no-cloud']:takeImage({
    category = 'screenshots',
    playerId = GetPlayerServerId(PlayerId())
})

if result.ok then
    print('Screenshot uploaded:', result.dataUrl)
end
```

### Configuration

Add to your `fxmanifest.lua`:

```lua
fx_version 'cerulean'
game 'gta5'

client_script 'dist/client.js'
server_script 'dist/server.js'

ui_page 'dist/web/index.html'

files {
    'dist/web/index.html',
    'dist/web/index.js',
    'dist/web/index.css'
}
```

## Project Structure

```
src/
├── client/          # FiveM client-side code
│   ├── index.ts     # Entry point
│   ├── exports.ts   # Exported functions
│   ├── nui.ts       # NUI communication
│   └── lib/         # Client utilities
├── server/          # FiveM server-side code
│   ├── index.ts     # Entry point
│   └── lib/         # Server utilities
├── common/          # Shared types and utilities
│   ├── index.ts
│   ├── types.ts
│   └── rpc.ts
└── web/             # NUI (browser)
    ├── index.html
    ├── app.ts
    ├── NoCloudApp.ts  # Screenshot capture logic
    └── styles.css
```

## How It Works

1. **Client** calls `takeImage()` export
2. **Client** sends `request.image` message to NUI
3. **NUI** captures game view using WebGL + `CfxTexture`
4. **NUI** requests signed URL from client via `request.signedUrl` callback
5. **Client** requests signed URL from server via RPC
6. **Server** generates signed URL from NoCloud API
7. **NUI** uploads image to signed URL
8. **NUI** responds with final image URL via `response.image` callback

## Links

- 🌐 [NoneM Website](https://nonefivem.com)
- 📚 [Documentation](https://docs.nonefivem.com)
- 💬 [Discord](https://discord.com/invite/K9SEZ7HeaR)

## License

MIT © [NoCloud](https://dash.nonefivem.com)
