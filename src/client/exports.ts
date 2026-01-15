import { RPC, StorageItemMetadata } from "@common";
import { NUIManager } from "./nui";

export class ExportsManager {
  private initialized = false;

  constructor(
    private readonly rpc: RPC,
    private readonly nuiManager: NUIManager
  ) {}

  private async takeImage(metadata?: StorageItemMetadata) {
    const response = await this.nuiManager.takeImage(metadata);

    return response;
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;
    exports("takeImage", this.takeImage.bind(this));
  }
}
