import type { StorageItemMetadata } from "@common";
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
  constructor(
    private readonly client: NoCloud,
    private readonly rpc: ServerRPC
  ) {
    this.registerRPCs();
  }

  private registerRPCs() {
    this.rpc.on<RequestSignedUrlParams, SignedUrlResponse>(
      "request.signedUrl",
      this.handleRequestSignedUrl.bind(this)
    );
  }

  private async handleRequestSignedUrl(
    request: RequestSignedUrlParams
  ): Promise<SignedUrlResponse> {
    return this.generateSignedUrl(
      request.contentType,
      request.size,
      request.metadata
    );
  }

  async generateSignedUrl(
    contentType: string,
    size: number,
    metadata?: FileMetadata
  ): Promise<SignedUrlResponse> {
    return this.client.storage.generateSignedUrl(contentType, size, metadata);
  }

  async upload(
    body: FileBody,
    metadata?: FileMetadata
  ): Promise<UploadResponse> {
    return this.client.storage.upload(body, metadata);
  }

  async deleteMedia(mediaId: string): Promise<boolean> {
    try {
      await this.client.storage.delete(mediaId);
      return true;
    } catch {
      return false;
    }
  }
}
