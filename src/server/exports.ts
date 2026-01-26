import type { StorageManager } from "./storage";

export class ServerExportsManager {
  private initialized = false;

  constructor(private readonly storage: StorageManager) {}

  init() {
    if (this.initialized) return;
    this.initialized = true;

    globalThis.exports(
      "GenerateSignedUrl",
      this.storage.generateSignedUrl.bind(this.storage)
    );
    globalThis.exports("UploadMedia", this.storage.upload.bind(this.storage));
    globalThis.exports("DeleteMedia", this.storage.deleteMedia.bind(this.storage));
  }
}
