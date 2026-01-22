import type { StorageManager } from "./storage";

export class ServerExportsManager {
  private initialized = false;

  constructor(private readonly storage: StorageManager) {}

  init() {
    if (this.initialized) return;
    this.initialized = true;

    exports(
      "GenerateSignedUrl",
      this.storage.generateSignedUrl.bind(this.storage)
    );
    exports("UploadMedia", this.storage.upload.bind(this.storage));
    exports("DeleteMedia", this.storage.deleteMedia.bind(this.storage));
  }
}
