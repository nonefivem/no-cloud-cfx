import { Logger, type StorageItemMetadata } from "@common";
import type {
  FileBody,
  FileMetadata,
  NoCloud,
  SignedUrlResponse,
  UploadResponse
} from "@nocloud/sdk";
import { ServerRPC } from "./lib/server.rpc";

interface RequestSignedUrlParams {
  contentType: string;
  size: number;
  metadata?: StorageItemMetadata;
}

export class StorageManager {
  private readonly logger = new Logger("StorageManager");

  constructor(
    private readonly client: NoCloud,
    private readonly rpc: ServerRPC
  ) {
    this.registerRPCs();
  }

  private registerRPCs() {
    this.rpc.on<RequestSignedUrlParams, SignedUrlResponse>(
      "storage.requestSignedUrl",
      this.handleRequestSignedUrl.bind(this)
    );
  }

  private async handleRequestSignedUrl(
    _: number,
    params: RequestSignedUrlParams
  ): Promise<SignedUrlResponse> {
    return this.generateSignedUrl(params.contentType, params.size, params.metadata);
  }

  async generateSignedUrl(
    contentType: string,
    size: number,
    metadata?: FileMetadata
  ): Promise<SignedUrlResponse> {
    this.logger.debug(`Generating signed URL for ${contentType} (${size} bytes)`);
    return this.client.storage.generateSignedUrl(contentType, size, metadata);
  }

  async upload(body: FileBody, metadata?: FileMetadata): Promise<UploadResponse> {
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
