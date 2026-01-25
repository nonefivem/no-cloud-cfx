import { ClientRPC } from "./lib/client.rpc";
import { NUIManager } from "./nui";

export class ClientExportsManager {
  private initialized = false;

  constructor(
    private readonly rpc: ClientRPC,
    private readonly nuiManager: NUIManager
  ) {}

  init() {
    if (this.initialized) return;
    this.initialized = true;

    exports("TakeImage", this.nuiManager.takeImage.bind(this.nuiManager));
    exports("RequestSignedUrl", this.rpc.requestSignedUrl.bind(this.rpc));
  }
}
