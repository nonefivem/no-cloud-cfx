<div align="center">
  <img src="https://assets.nonefivem.com/logo/dark-bg.png" alt="NoneM Logo" width="200" />
  
  # NoCloud CFX SDK
  
  **Serverless storage and screenshot capture for FiveM and RedM**
  
  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Bun](https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh/)
  [![FiveM](https://img.shields.io/badge/FiveM-F40552?style=for-the-badge&logo=fivem&logoColor=white)](https://fivem.net/)
  [![RedM](https://img.shields.io/badge/RedM-8B0000?style=for-the-badge&logo=rockstargames&logoColor=white)](https://redm.net/)
</div>

---

## Overview

NoCloud CFX SDK provides seamless integration with the NoCloud platform, enabling FiveM and RedM servers to capture and upload in-game screenshots directly to cloud storage.

### Features

- 📸 **Native Screenshot Capture** - Uses `@citizenfx/three` and `CfxTexture` for direct game view capture
- ☁️ **Cloud Storage** - Upload screenshots directly to NoCloud's serverless storage
- 🔒 **Signed URLs** - Secure uploads with pre-signed URLs
- ⚡ **Zero Dependencies** - Self-contained, no external resources required
- 🛠️ **TypeScript First** - Full type safety across client, server, and NUI

## Installation

### 1. Download the SDK

Download the latest release from [GitHub Releases](https://github.com/nonefivem/no-cloud-cfx/releases).

### 2. Extract to Resources

Unzip the downloaded file and place the `nocloud` folder into your server's `resources` directory.

```
resources/
└── nocloud/
```

### 3. Configure server.cfg

Add the following line to your `server.cfg` to ensure the resource starts:

```cfg
ensure nocloud
```

### 4. Set API Key

Add your NoCloud API key to your `server.cfg`:

```cfg
set NOCLOUD_API_KEY "your_api_key"
```

> **Note:** You can get your API key from the [NoCloud Dashboard](https://dash.nonefivem.com).

## Usage

### Client Exports

```lua
-- Take a screenshot and upload to cloud storage
local result = exports.cloud:TakeImage({
    reason = "mugshot"
})

if result then
    print('Screenshot uploaded:', result.url)
    print('Media ID:', result.id)
end

-- Generate a signed URL for client-side uploads
local signedUrl = exports.nocloud:GenerateSignedUrl('image/png', 1024, {
    location = json.encode(GetPlayerCoords(PlayerPedId()))
})
```

### Server Exports

```lua
-- Generate a signed URL for uploading
local signedUrl = exports.nocloud:GenerateSignedUrl('image/png', 1024, {
    player_id = 1
})

-- Upload a file directly (base64 or raw data)
local result = exports.nocloud:UploadMedia(base64Data, {
    player_id = 1
})

-- Delete a file from storage
local success = exports.nocloud:DeleteMedia(mediaId)
```

### Lua Libraries

The Lua libraries provide type-annotated wrappers around the exports. Add them to your `fxmanifest.lua`:

```lua
-- For client-side usage
client_script '@nocloud/lib/client.lua'

-- For server-side usage
server_script '@nocloud/lib/server.lua'
```

**Client-side usage:**

```lua
-- Cloud global is available after including the library
local result = Cloud.storage:take_image({ type = 'screenshot' })
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

## Links

- 🌐 [NoneM Website](https://nonefivem.com)
- 📚 [Documentation](https://docs.nonefivem.com)
- 💬 [Discord](https://discord.nonefivem.com)

## License

MIT © [NoCloud](https://dash.nonefivem.com)
