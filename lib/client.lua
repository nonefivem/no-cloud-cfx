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
---@field take_image fun(self, metadata?: table): UploadResponse? Screenshot upload
---@field request_signed_url fun(self, contentType?: string, size?: number, metadata?: table): SignedUrlResponse? Request signed URL for uploads

---@alias FlagType "boolean"|"string"|"number"|"json"

--- Feature flags.
---
--- Clients read the flags out of GlobalState, which the server publishes and
--- the game replicates on its own. Reading it costs no network and no round
--- trip, so these are plain synchronous reads - safe inside a tick - and a
--- joining player holds the values before this resource runs a line.
---
--- Only flags marked "shared" are published, so reading a server-only flag here
--- is exactly like reading one that does not exist.
---
--- To react to a change, watch the state bag directly:
---   AddStateBagChangeHandler('nocloud_flags', 'global', function(_, _, values)
---       -- values is every flag this client holds
---   end)
---
--- Reading tells the server that this client reads flags, so that it keeps them
--- current, and five minutes without a read tells it you have stopped. Those
--- signals carry no data and only fire at the edges; every read is a local
--- lookup and nothing more.
---@class CloudFlags
---@field get_all fun(self): table Every flag this client holds, keyed by flag key
---@field get_value fun(self, key: string, fallback?: any): any Read a flag's value
---@field is_enabled fun(self, key: string, fallback?: boolean): boolean Read a boolean flag
---@field is_ready fun(self): boolean Whether the server has published any values yet

---@class Cloud
---@field storage CloudStorage
---@field flags CloudFlags
Cloud = {
    storage = {},
    flags = {}
}

--- Takes a screenshot and uploads it to cloud storage.
---@param metadata? table Metadata to associate with the image
---@return UploadResponse? response Response containing the ID and URL of the uploaded image
function Cloud.storage:take_image(metadata)
    return nocloud:TakeImage(metadata)
end

--- Requests a signed URL for uploading a file.
--- When called with contentType and size, returns a pre-allocated URL with mediaId and mediaUrl.
--- When called without options, returns a non-allocated URL with just url and expiresAt.
---@param contentType? string The MIME type of the file
---@param size? number The size of the file in bytes
---@param metadata? table Optional metadata for the file (only used with pre-allocated)
---@return SignedUrlResponse? response Response containing the signed URL and media info
function Cloud.storage:request_signed_url(contentType, size, metadata)
    return nocloud:RequestSignedUrl(contentType, size, metadata)
end

--- Reads every flag this client holds, keyed by flag key.
---@return table values The flag values
function Cloud.flags:get_all()
    return nocloud:GetFlags()
end

--- Reads a flag's value, whatever its type.
---@param key string The flag's key
---@param fallback? any Returned when the flag is missing, or before the server has published any
---@return any value The flag's value, or the fallback
function Cloud.flags:get_value(key, fallback)
    return nocloud:GetFlagValue(key, fallback)
end

--- Checks whether a boolean flag is on.
---@param key string The flag's key
---@param fallback? boolean Returned when the flag is not a readable boolean flag, false by default
---@return boolean enabled Whether the flag is on
function Cloud.flags:is_enabled(key, fallback)
    return nocloud:IsFlagEnabled(key, fallback)
end

--- Whether the server has published any values yet.
---@return boolean ready
function Cloud.flags:is_ready()
    return nocloud:AreFlagsReady()
end

return Cloud
