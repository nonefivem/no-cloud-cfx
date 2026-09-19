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
- 🚩 **Feature Flags** - Read NoCloud feature flags on the server and on clients, fetched only when something actually uses them
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

-- Feature flags, read straight from replicated state
if Cloud.flags:is_enabled('new-hud') then
    -- ...
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

-- Feature flags
local maxPlayers = Cloud.flags:get_value('max-players', 32)
local cached = Cloud.flags:get_cached()
```

## Feature Flags

A feature flag is a named, typed value: you read it and decide what to do with
it. Flip one in the [dashboard](https://dash.nonefivem.com) and a live server
picks it up without a restart.

Each flag has a **runtime**, which says where it may be read:

| Runtime  | Who can read it                  |
| -------- | -------------------------------- |
| `shared` | Your server and players' clients |
| `server` | Your server only                 |

Your server holds the API key, so it receives every flag. A `server` flag is
never published to clients, and reads on the client behave exactly like a flag
that does not exist - so a secret cannot reach a player by accident.

### What Costs a Request

Nothing is fetched until a flag is read. **A server whose players never read a
flag makes one request in its life** - at the first start after installing, so
clients are not left reading an empty state bag. Restarts after that cost
nothing: the stored snapshot fills it on the first tick.

Server-side reads serve from memory for `cache_ttl_seconds` and go to the API
when that has passed, so a read is usually free and never more than one request
per window. They never start a background loop - a read refreshes itself.

The cache window bounds the polling loop too: a tick that lands on a
configuration still inside it skips rather than spending a request to be told
nothing changed. A read and a poll are the same fetch, so whichever happens
first covers the other.

Polling is for clients, and by default runs only while there are any. A client
reads replicated state, which the server can neither see nor refresh on demand,
so a client that is reading says so: the flags are refetched every
`polling.interval_ms` from that point, and stop when the last such player
disconnects or goes quiet. A client unsubscribes itself after five minutes
without a read, and resubscribes on the next one, so a player who checked one
flag on spawn does not hold the server to polling all session. Reading in a tick
sends nothing - the signals are two empty events at the edges.

Set `polling.enabled` to `true` to poll regardless of whether anyone is reading.
That is what you want when something *watches* rather than reads - a
`AddStateBagChangeHandler` on the state bag, or a `nocloud.flags.updated`
handler - since a change nobody reads is a change nothing would otherwise go and
find.

```lua
AddEventHandler('nocloud.flags.updated', function(values, changes)
    for _, change in ipairs(changes) do
        print(change.key, change.kind, json.encode(change.current))
    end
end)
```

Each `changes` entry holds `key`, `kind` (`added`, `updated` or `removed`),
`type`, `runtime`, `previous` and `current`. This is a local server event -
values never cross the network as an event.

### Server Exports

Reads are asynchronous: they resolve from memory when the configuration is
current, and fetch when it is not.

```lua
if exports.nocloud:IsFlagEnabled('new-hud', false) then
    -- ...
end

local maxPlayers = exports.nocloud:GetFlagValue('max-players', 32)

-- A flag whole: { key, type, value, runtime }
local flag = exports.nocloud:GetFlag('max-players')

-- Every flag the server holds, keyed by flag key
local all = exports.nocloud:GetFlags()

-- Exactly what clients are given
local shared = exports.nocloud:GetFlags('shared')

-- The values held right now, no request, returns immediately
local cached = exports.nocloud:GetCachedFlags()

-- Refetch now, ignoring the cache window
exports.nocloud:RefreshFlags()

-- Whether those values are from a fetch, or the last known ones
local stale = exports.nocloud:AreFlagsStale()
```

Server reads see every flag by default, because the server is the trusted side.
Pass `'shared'` as the last argument to read as a client would.

### Clients

Clients read the shared flags out of `GlobalState`, which the server publishes
and the game replicates. There is no round trip and no request - the value is
already on the machine - so client reads are synchronous and safe in a tick.

```lua
-- Straight from the state bag
local flags = GlobalState.nocloud_flags
if flags and flags['new-hud'] then
    -- ...
end

-- Or through the exports, which handle the empty case
if exports.nocloud:IsFlagEnabled('new-hud') then
    -- ...
end

local motd = exports.nocloud:GetFlagValue('motd', 'Welcome')
local all = exports.nocloud:GetFlags()
```

To react to a change:

```lua
AddStateBagChangeHandler('nocloud_flags', 'global', function(_, _, values)
    print('flags changed:', json.encode(values))
end)
```

Reading here tells the server that this client reads flags, so that it keeps
them current - and five minutes without a read tells it you have stopped. See
[What Costs a Request](#what-costs-a-request). Those signals carry no data and
only fire at the edges; every read is a local state bag lookup and nothing
more.

### From the NUI

The web UI reads the same values, over NUI callbacks. Extend `NoCloudApp` and
use its helpers:

```ts
class App extends NoCloudApp {
  protected async init(): Promise<void> {
    if (await this.isFlagEnabled('new-hud')) {
      // ...
    }

    const motd = await this.getFlagValue('motd', 'Welcome');
    const all = await this.getFlags();
  }

  // Pushed by the client when the values change - nothing to poll for
  protected onFlagsUpdated(flags: FlagValues): void {
    console.log('flags changed', flags);
  }
}
```

Or call the callbacks directly, from any UI:

| Callback              | Body                   | Replies with                            |
| --------------------- | ---------------------- | --------------------------------------- |
| `flags.getFlags`      | `{}`                   | `{ ok, payload: { key: value, ... } }`  |
| `flags.getFlagValue`  | `{ key, fallback? }`   | `{ ok, payload: value \| null }`        |
| `flags.isFlagEnabled` | `{ key, fallback? }`   | `{ ok, payload: boolean }`              |
| `flags.areFlagsReady` | `{}`                   | `{ ok, payload: boolean }`              |

A change is pushed as a `flags.updated` window message carrying
`{ flags: { key: value, ... } }`.

These reads reach the client script's copy of replicated state, so they are a
local round trip rather than a request to anything - cheap, but not free. Read
what you need once rather than per frame, and let `onFlagsUpdated` tell you when
it changes.

Reading here counts as a read, so it keeps this client counted as a flag reader
and the values current. Watching alone does not: a change only arrives once the
server has noticed it, which needs this UI reading, or `polling.enabled` set.

### Last Known Values

Every snapshot the server receives is kept in resource key/value storage, so the
values are there before the first fetch answers and stay there when it does not:
a restart serves them on the first tick, and a NoCloud outage leaves a running
server reading exactly what it read before. `AreFlagsStale()` says whether what
you are reading came from that cache.

The cache holds every flag, server-only ones included, and never leaves the
server host. Set `persist_last_known` to `false` to turn it off, in which case
reads fall back until the first fetch answers.

### Configuration

```json
"flags": {
  "enabled": true,
  "cache_ttl_seconds": 10,
  "global_state_key": "nocloud_flags",
  "persist_last_known": true,
  "polling": {
    "enabled": false,
    "interval_ms": 60000
  }
}
```

| Option                 | Description                                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `enabled`              | Whether flags are available at all. With this off every read falls back and nothing is fetched                     |
| `cache_ttl_seconds`    | How long a fetched configuration is served from memory before a read goes back to the API                          |
| `global_state_key`     | The `GlobalState` key the shared values are published under                                                        |
| `persist_last_known`   | Keeps the last values received, so a restart serves them immediately and an unreachable API never empties them     |
| `polling.enabled`      | Poll whether or not a client is reading. Off by default - turn it on for code that watches rather than reads       |
| `polling.interval_ms`  | How often the flags are refetched while polling runs. A tick inside `cache_ttl_seconds` skips                      |

## Links

- 🌐 [NoneM Website](https://nonefivem.com)
- 📚 [Documentation](https://docs.nonefivem.com)
- 💬 [Discord](https://discord.nonefivem.com)

## License

MIT © [NoCloud](https://dash.nonefivem.com)
