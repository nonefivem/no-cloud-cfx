import { StorageItemMetadata } from "@common";
import { populateMetadataAttachments } from "../common/utils";
import { ClientRPC } from "./lib/client.rpc";
import { NUIManager } from "./nui";

export class ClientExportsManager {
  private initialized = false;

  constructor(
    private readonly rpc: ClientRPC,
    private readonly nuiManager: NUIManager
  ) {}

  private handleTakeImage(metadata?: StorageItemMetadata) {
    return this.nuiManager.takeImage(populateMetadataAttachments(metadata));
  }

  private handleRequestSignedUrl(
    contentType?: string,
    size?: number,
    metadata?: StorageItemMetadata
  ) {
    return this.rpc.requestSignedUrl({
      contentType,
      size,
      metadata: populateMetadataAttachments(metadata)
    });
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    globalThis.exports("TakeImage", this.handleTakeImage.bind(this));
    globalThis.exports(
      "RequestSignedUrl",
      this.handleRequestSignedUrl.bind(this)
    );
  }
}
