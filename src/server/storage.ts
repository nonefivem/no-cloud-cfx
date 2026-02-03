import { config, Logger, type StorageItemMetadata } from "@common";
import type {
  FileBody,
  FileMetadata,
  NoCloud,
  SignedUrlResponse,
  UploadResponse
} from "@nocloud/sdk";
import { RateLimiter } from "./lib/rate.limiter";
import { ServerRPC } from "./lib/server.rpc";

interface RequestSignedUrlParams {
  contentType: string;
  size: number;
  metadata?: StorageItemMetadata;
}

export class StorageManager {
  private readonly MAX_FILE_SIZE_BYTES =
    config.storage.max_file_size_mb * 1024 * 1024;
  private readonly logger = new Logger("StorageManager");
  private readonly rateLimiter = new RateLimiter({
    name: "storage",
    clientIdentifier: config.storage.rate_limit.client_identifier_extractor,
    maxRequests: config.storage.rate_limit.max_requests,
    windowMs: config.storage.rate_limit.window_ms
  });

  constructor(
    private readonly client: NoCloud,
    rpc: ServerRPC
  ) {
    // If client uploads are enabled, register the RPC handler
    if (config.storage.enable_client_uploads) {
      rpc.on<RequestSignedUrlParams, SignedUrlResponse>(
        "storage.requestSignedUrl",
        this.handleRequestSignedUrl.bind(this)
      );
    } else {
      this.logger.info("Client uploads are disabled in the configuration");
    }
  }

  private async handleRequestSignedUrl(
    player_id: number,
    params: RequestSignedUrlParams
  ): Promise<SignedUrlResponse> {
    if (!this.rateLimiter.limit(player_id)) {
      this.logger.warn(`Rate limit exceeded for player ID: ${player_id}`);
      throw new Error("Rate limit exceeded. Please try again later.");
    }

    return this.generateSignedUrl(
      params.contentType,
      params.size,
      params.metadata
    );
  }

  async generateSignedUrl(
    contentType: string,
    size: number,
    metadata?: FileMetadata
  ): Promise<SignedUrlResponse> {
    this.logger.debug(
      `Generating signed URL for ${contentType} (${size} bytes)`
    );

    if (size > this.MAX_FILE_SIZE_BYTES) {
      this.logger.warn(
        `Upload size ${size} exceeds maximum allowed size of ${this.MAX_FILE_SIZE_BYTES} bytes`
      );
      throw new Error(
        `File size exceeds the maximum allowed limit of ${this.MAX_FILE_SIZE_BYTES} bytes.`
      );
    }

    return this.client.storage.generateSignedUrl(contentType, size, metadata);
  }

  async upload(
    body: FileBody,
    metadata?: FileMetadata
  ): Promise<UploadResponse> {
    this.logger.debug("Uploading file to storage");
    const response = await this.client.storage.upload(body, metadata);
    this.logger.info(`File uploaded successfully: ${response.id}`);
    return response;
  }

  async deleteMedia(mediaId: string | string[]): Promise<boolean> {
    try {
      this.logger.debug(
        `Deleting media: ${Array.isArray(mediaId) ? mediaId.join(", ") : mediaId}`
      );
      await this.client.storage.delete(mediaId);
      this.logger.info(
        `Media deleted successfully: ${Array.isArray(mediaId) ? mediaId.join(", ") : mediaId}`
      );
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete media: ${(error as Error).message}`);
      return false;
    }
  }
}
