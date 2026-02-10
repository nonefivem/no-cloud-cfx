import { config, StorageItemMetadata } from "@common";
import type { UploadResponse } from "@nocloud/sdk";
import {
  extractPlayerIdentifier,
  populateMetadataAttachments
} from "../common/utils";
import { ServerRPC } from "./lib/server.rpc";
import type { StorageManager } from "./storage";

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
    return this.rpc.call<UploadResponse>(
      "storage.takeImage",
      playerId,
      populateMetadataAttachments(metadata, playerId) ?? {}
    );
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
    globalThis.exports(
      "DeleteMedia",
      this.storage.deleteMedia.bind(this.storage)
    );
  }
}
