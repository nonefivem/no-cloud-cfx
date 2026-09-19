import { StorageItemMetadata } from "@common";
import type { UploadResponse } from "@nocloud/sdk";
import { populateMetadataAttachments } from "../common/utils";
import type { FlagsManager } from "./flags";
import { ServerRPC } from "./lib/server.rpc";
import type { StorageManager } from "./storage";

export class ServerExportsManager {
  private initialized = false;

  constructor(
    private readonly rpc: ServerRPC,
    private readonly storage: StorageManager,
    private readonly flags: FlagsManager
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

    globalThis.exports("GetFlag", this.flags.getFlag.bind(this.flags));
    globalThis.exports("GetFlags", this.flags.getFlags.bind(this.flags));
    globalThis.exports(
      "GetFlagValue",
      this.flags.getFlagValue.bind(this.flags)
    );
    globalThis.exports("IsFlagEnabled", this.flags.isEnabled.bind(this.flags));
    globalThis.exports(
      "GetCachedFlags",
      this.flags.getCachedFlags.bind(this.flags)
    );
    globalThis.exports("RefreshFlags", this.flags.refresh.bind(this.flags));
    globalThis.exports("AreFlagsReady", () => this.flags.ready);
    globalThis.exports("AreFlagsStale", () => this.flags.stale);
  }
}
