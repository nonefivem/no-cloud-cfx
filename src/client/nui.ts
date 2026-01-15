import type { StorageItemMetadata } from "@common";
import { ClientRPC } from "./lib/client.rpc";

interface RequestSignedUrlParams {
  contentType: string;
  size: number;
  metadata?: StorageItemMetadata;
}

type RequestSignedUrlResponse =
  | { ok: true; url: string }
  | { ok: false; url: null };

export class NUIManager {
  private initialized = false;
  private requestIdCounter: number = 0;
  private readonly pendingRequests: Map<
    number,
    { resolve: (value: any) => void; reject: (reason?: any) => void }
  > = new Map();

  constructor(private readonly service: ClientRPC) {}

  private handleImageResponse(data: any, cb: Function) {
    const pending = this.pendingRequests.get(data.requestId);

    if (!pending) {
      cb({ ok: false });
      return;
    }

    this.pendingRequests.delete(data.requestId);
    pending.resolve({ ok: data.ok, dataUrl: data.dataUrl });
    cb({ ok: true });
  }

  private async handleSignedUrlRequest(
    data: RequestSignedUrlParams,
    cb: (response: RequestSignedUrlResponse) => void
  ) {
    try {
      if (!data.contentType || !data.size) {
        throw new Error("Invalid parameters");
      }

      const url = await this.service.requestSignedUrl(data);

      cb({ ok: true, url });
    } catch {
      cb({ ok: false, url: null });
    }
  }

  /**
   * Initializes the NUI manager by registering necessary callbacks.
   */
  init() {
    if (this.initialized) return;
    this.initialized = true;

    RegisterNuiCallback(
      "request.signedUrl",
      this.handleSignedUrlRequest.bind(this)
    );

    RegisterNuiCallback("response.image", this.handleImageResponse.bind(this));
  }

  /**
   * Takes an image using the NUI and returns the result.
   * @param metadata - Optional metadata for the image.
   * @returns A promise that resolves with the image data URL or an error.
   */
  takeImage(metadata?: StorageItemMetadata) {
    return new Promise<{ ok: boolean; dataUrl?: string }>((resolve, reject) => {
      const requestId = this.requestIdCounter++;

      this.pendingRequests.set(requestId, { resolve, reject });

      SendNUIMessage({
        event: "request.image",
        data: {
          requestId,
          metadata,
        },
      });
    });
  }
}
