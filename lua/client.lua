local CLOUD_EXPORTS = exports.nocloud

---@class UploadResponse
---@field public id string ID of the uploaded file
---@field public url string URL of the uploaded file

---@class SignedUrlResponse
---@field public url string The signed URL for uploading
---@field public expiresAt string Expiration time in ISO 8601 format
---@field public mediaId string The unique identifier for the media after upload
---@field public mediaUrl string The public URL to access the media after upload

---@class CloudStorage
---@field take_image fun(self, metadata?: table): UploadResponse? Screenshot upload

---@class Cloud
---@field storage CloudStorage
Cloud = {
    storage = {}
}

--- Takes a screenshot and uploads it to cloud storage.
---@param metadata? table Metadata to associate with the image
---@return UploadResponse? response Response containing the ID and URL of the uploaded image
function Cloud.storage:take_image(metadata)
    return CLOUD_EXPORTS:TakeImage(metadata)
end

--- Generates a signed URL for uploading a file.
---@param contentType string The MIME type of the file
---@param size number The size of the file in bytes
---@param metadata? table Optional metadata for the file
---@return SignedUrlResponse? response Response containing the signed URL and media info
function Cloud.storage:generate_signed_url(contentType, size, metadata)
    return CLOUD_EXPORTS:GenerateSignedUrl(contentType, size, metadata)
end

return Cloud
