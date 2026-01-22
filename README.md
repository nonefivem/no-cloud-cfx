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

- **`nocloud-v*.zip`** - Production build (minified)
- **`nocloud-v*-dev.zip`** - Development build (non-minified, with sourcemaps)

Extract to your `resources` folder and add to your `server.cfg`:

```cfg
ensure nocloud
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

lua/
├── client.lua      # Lua client library (type-annotated)
└── server.lua      # Lua server library (type-annotated)
```

## Usage

### Client Exports

```lua
-- Take a screenshot and upload to cloud storage
local result = exports['nocloud']:TakeImage({
    category = 'screenshots',
    playerId = GetPlayerServerId(PlayerId())
})

if result then
    print('Screenshot uploaded:', result.url)
    print('Media ID:', result.id)
end

-- Generate a signed URL for client-side uploads
local signedUrl = exports['nocloud']:GenerateSignedUrl('image/png', 1024, {
    category = 'uploads'
})
```

### Server Exports

```lua
-- Generate a signed URL for uploading
local signedUrl = exports['nocloud']:GenerateSignedUrl('image/png', 1024, {
    category = 'uploads'
})

-- Upload a file directly (base64 or raw data)
local result = exports['nocloud']:UploadMedia(base64Data, {
    category = 'files'
})

-- Delete a file from storage
local success = exports['nocloud']:DeleteMedia(mediaId)
```

### Lua Libraries

The Lua libraries provide type-annotated wrappers around the exports. Add them to your `fxmanifest.lua`:

```lua
-- For client-side usage
client_script '@nocloud/lua/client.lua'

-- For server-side usage
server_script '@nocloud/lua/server.lua'
```

**Client-side usage:**

```lua
-- Cloud global is available after including the library
local result = Cloud.storage:take_image({ category = 'screenshots' })
if result then
    print('Uploaded:', result.url)
end
```

**Server-side usage:**

```lua
-- Cloud global is available after including the library

-- Generate signed URL
local signedUrl = Cloud.storage:generate_signed_url('image/png', 1024)

-- Upload file
local result = Cloud.storage:upload(base64Data, { category = 'files' })

-- Delete file
local success = Cloud.storage:delete_media(mediaId)
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

## Links

- 🌐 [NoneM Website](https://nonefivem.com)
- 📚 [Documentation](https://docs.nonefivem.com)
- 💬 [Discord](https://discord.com/invite/K9SEZ7HeaR)

## License

MIT © [NoCloud](https://dash.nonefivem.com)
