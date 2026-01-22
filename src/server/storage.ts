import type { StorageItemMetadata } from "@common";
import type { NoCloud, SignedUrlResponse } from "@nocloud/sdk";
import { ServerRPC } from "./lib/server.rpc";

interface RequestSignedUrlParams {
  contentType: string;
  size: number;
  metadata?: StorageItemMetadata;
}

export class StorageManager {
  constructor(
    private readonly client: NoCloud,
    private readonly rpc: ServerRPC,
  ) {
    this.registerRPCs();
  }

  private registerRPCs() {
    this.rpc.on<RequestSignedUrlParams, SignedUrlResponse>(
      "request.signedUrl",
      this.handleRequestSignedUrl.bind(this),
    );
  }

  private async handleRequestSignedUrl(
    request: RequestSignedUrlParams,
  ): Promise<SignedUrlResponse> {
    const signedUrl = await this.client.storage.generateSignedUrl(
      request.contentType,
      request.size,
      request.metadata,
    );

    return signedUrl;
  }
}
