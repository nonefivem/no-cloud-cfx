local nocloud = exports.nocloud

---@class UploadResponse
---@field public id string ID of the uploaded file
---@field public url string URL of the uploaded file

---@class SignedUrlResponse
---@field public url string The signed URL for uploading
---@field public expiresAt string Expiration time in ISO 8601 format
---@field public mediaId string The unique identifier for the media after upload
---@field public mediaUrl string The public URL to access the media after upload

---@class CloudStorage
---@field take_image fun(self, player_id: number, metadata?: table): UploadResponse? Screenshot upload
---@field generate_signed_url fun(self, contentType: string, size: number, metadata?: table): SignedUrlResponse? Generate signed URL for uploads
---@field upload fun(self, body: string, metadata?: table): UploadResponse? Upload file
---@field upload_stream fun(self, stream: any, contentType: string, contentLength: number, metadata?: table): UploadResponse? Upload stream
---@field delete_media fun(self, mediaId: string|string[]): boolean Delete file

---@class Cloud
---@field storage CloudStorage
Cloud = {
    storage = {}
}

--- Takes a screenshot and uploads it to cloud storage.
---@param player_id number The ID of the player requesting the screenshot
---@param metadata? table Metadata to associate with the image
---@return UploadResponse? response Response containing the ID and URL of the uploaded image
function Cloud.storage:take_image(player_id, metadata)
    return nocloud:TakeImage(player_id, metadata)
end

--- Generates a signed URL for uploading a file.
---@param contentType string The MIME type of the file
---@param size number The size of the file in bytes
---@param metadata? table Optional metadata for the file
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

return Cloud
