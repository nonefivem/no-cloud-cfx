local nocloud = exports.nocloud

---@class UploadResponse
---@field public id string ID of the uploaded file
---@field public url string URL of the uploaded file

---@class SignedUrlResponse
---@field public url string The signed URL for uploading
---@field public expiresAt string Expiration time in ISO 8601 format
---@field public mediaId? string The unique identifier for the media after upload (pre-allocated only)
---@field public mediaUrl? string The public URL to access the media after upload (pre-allocated only)

---@class CloudStorage
---@field take_image fun(self, player_id: number, metadata?: table): UploadResponse? Screenshot upload
---@field generate_signed_url fun(self, contentType?: string, size?: number, metadata?: table): SignedUrlResponse? Generate signed URL for uploads
---@field upload fun(self, body: string, metadata?: table): UploadResponse? Upload file
---@field upload_stream fun(self, stream: any, contentType: string, contentLength: number, metadata?: table): UploadResponse? Upload stream
---@field delete_media fun(self, mediaId: string|string[]): boolean Delete file

---@alias FlagRuntime "server"|"shared"
---@alias FlagType "boolean"|"string"|"number"|"json"

---@class FlagEntry
---@field public key string The flag's key
---@field public type FlagType The kind of value the flag holds
---@field public value any The flag's current value
---@field public runtime FlagRuntime Where the flag may be read

---@class FlagChange
---@field public key string The flag's key
---@field public kind "added"|"updated"|"removed" How it differs from before
---@field public type FlagType The kind of value the flag holds
---@field public runtime FlagRuntime Where the flag may be read
---@field public previous any The value before the change, nil when added
---@field public current any The value after the change, nil when removed

--- Feature flags.
---
--- Reads are made on behalf of a runtime and default to "server" here, because
--- the server is the trusted side and receives every flag. Pass "shared" to see
--- exactly what players are given.
---
--- Reads are asynchronous: they serve the configuration held in memory and go
--- to the API only when it has aged past the cache window, so a read is usually
--- free and refreshes itself. Background polling runs while at least one player
--- is reading flags - or always, if the configuration turns it on - and skips
--- any turn that lands while the held configuration is still fresh.
---
--- The last values received are kept in resource storage, so a restart serves
--- them straight away and an unreachable API never empties them. is_stale()
--- says whether what you are reading came from that cache.
---
--- Event (register with AddEventHandler), fired when a fetch finds a change:
---   nocloud.flags.updated(values, changes)
---@class CloudFlags
---@field get fun(self, key: string, runtime?: FlagRuntime): FlagEntry? Read a flag whole
---@field get_all fun(self, runtime?: FlagRuntime): table Every readable flag, keyed by flag key
---@field get_value fun(self, key: string, fallback?: any, runtime?: FlagRuntime): any Read a flag's value
---@field is_enabled fun(self, key: string, fallback?: boolean, runtime?: FlagRuntime): boolean Read a boolean flag
---@field get_cached fun(self, runtime?: FlagRuntime): table The values held right now, no request
---@field refresh fun(self): table Refetch the flags now, ignoring the cache window
---@field is_ready fun(self): boolean Whether there are values to read
---@field is_stale fun(self): boolean Whether those values came from the cache rather than a fetch

---@class Cloud
---@field storage CloudStorage
---@field flags CloudFlags
Cloud = {
    storage = {},
    flags = {}
}

--- Takes a screenshot and uploads it to cloud storage.
---@param player_id number The ID of the player requesting the screenshot
---@param metadata? table Metadata to associate with the image
---@return UploadResponse? response Response containing the ID and URL of the uploaded image
function Cloud.storage:take_image(player_id, metadata)
    return nocloud:TakeImage(player_id, metadata)
end

--- Generates a signed URL for uploading a file.
--- When called with contentType and size, returns a pre-allocated URL with mediaId and mediaUrl.
--- When called without options, returns a non-allocated URL with just url and expiresAt.
---@param contentType? string The MIME type of the file
---@param size? number The size of the file in bytes
---@param metadata? table Optional metadata for the file (only used with pre-allocated)
---@return SignedUrlResponse? response Response containing the signed URL and media info
function Cloud.storage:generate_signed_url(contentType, size, metadata)
    return nocloud:GenerateSignedUrl(contentType, size, metadata)
end

--- Uploads a file to cloud storage.
---@param body string The file content (base64 string or raw data)
---@param metadata? table Optional metadata for the file
---@return UploadResponse? response Response containing the ID and URL of the uploaded file
function Cloud.storage:upload(body, metadata)
    return nocloud:UploadMedia(body, metadata)
end

--- Deletes a file from cloud storage.
---@param mediaId string|string[] The ID(s) of the file(s) to delete
---@return boolean success Whether the deletion was successful
function Cloud.storage:delete_media(mediaId)
    return nocloud:DeleteMedia(mediaId)
end

--- Reads a flag whole - its key, type, value and runtime.
---@param key string The flag's key
---@param runtime? FlagRuntime The runtime reading the flag, "server" by default
---@return FlagEntry? flag The flag, or nil if it does not exist or this runtime may not read it
function Cloud.flags:get(key, runtime)
    return nocloud:GetFlag(key, runtime)
end

--- Reads every flag this runtime may see, keyed by flag key.
---@param runtime? FlagRuntime The runtime reading the flags, "server" by default
---@return table values The flag values
function Cloud.flags:get_all(runtime)
    return nocloud:GetFlags(runtime)
end

--- Reads a flag's value, whatever its type.
---@param key string The flag's key
---@param fallback? any Returned when the flag is missing or unreadable
---@param runtime? FlagRuntime The runtime reading the flag, "server" by default
---@return any value The flag's value, or the fallback
function Cloud.flags:get_value(key, fallback, runtime)
    return nocloud:GetFlagValue(key, fallback, runtime)
end

--- Checks whether a boolean flag is on.
---@param key string The flag's key
---@param fallback? boolean Returned when the flag is not a readable boolean flag, false by default
---@param runtime? FlagRuntime The runtime reading the flag, "server" by default
---@return boolean enabled Whether the flag is on
function Cloud.flags:is_enabled(key, fallback, runtime)
    return nocloud:IsFlagEnabled(key, fallback, runtime)
end

--- Reads the values held right now, without contacting the API. Unlike the
--- other reads this one returns immediately rather than a promise.
---@param runtime? FlagRuntime The runtime reading the flags, "server" by default
---@return table values The flag values held in memory
function Cloud.flags:get_cached(runtime)
    return nocloud:GetCachedFlags(runtime)
end

--- Refetches the flags now, ignoring the cache window.
---@return table values The flags the server now holds
function Cloud.flags:refresh()
    return nocloud:RefreshFlags()
end

--- Whether there are values to read. False only before the first fetch answers
--- with no cached snapshot to fall back on.
---@return boolean ready
function Cloud.flags:is_ready()
    return nocloud:AreFlagsReady()
end

--- Whether the values being served came from the last-known cache rather than
--- from a fetch.
---@return boolean stale
function Cloud.flags:is_stale()
    return nocloud:AreFlagsStale()
end

return Cloud
