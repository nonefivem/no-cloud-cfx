import { StorageItemMetadata } from "@common";
import { ClientRPC } from "./lib/client.rpc";
import { NUIManager } from "./nui";

export class ClientExportsManager {
  private initialized = false;

  constructor(
    private readonly rpc: ClientRPC,
    private readonly nuiManager: NUIManager
  ) {}

  private async takeImage(metadata?: StorageItemMetadata) {
    const response = await this.nuiManager.takeImage(metadata);

    return response;
  }

  private async generateSignedUrl(
    contentType: string,
    size: number,
    metadata?: StorageItemMetadata
  ) {
    return this.rpc.requestSignedUrl({
      contentType,
      size,
      metadata
    });
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    exports("TakeImage", this.takeImage.bind(this));
    exports("GenerateSignedUrl", this.generateSignedUrl.bind(this));
  }
}
