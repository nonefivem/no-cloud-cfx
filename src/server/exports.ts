import type { UploadResponse } from "@nocloud/sdk";
import { ServerRPC } from "./lib/server.rpc";
import type { StorageManager } from "./storage";
import { StorageItemMetadata } from "@common";

export class ServerExportsManager {
  private initialized = false;

  constructor(
    private readonly rpc: ServerRPC,
    private readonly storage: StorageManager
  ) {}

  private async handleTakeImage(
    playerId: number,
    metadata?: StorageItemMetadata
  ): Promise<UploadResponse> {
    return this.rpc.call<UploadResponse>("storage.takeImage", playerId, metadata || {});
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    globalThis.exports("TakeImage", this.handleTakeImage.bind(this));
    globalThis.exports(
      "GenerateSignedUrl",
      this.storage.generateSignedUrl.bind(this.storage)
    );
    globalThis.exports("UploadMedia", this.storage.upload.bind(this.storage));
    globalThis.exports("DeleteMedia", this.storage.deleteMedia.bind(this.storage));
  }
}
