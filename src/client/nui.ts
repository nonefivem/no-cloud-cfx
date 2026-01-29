import type { StorageItemMetadata } from "@common";
import { SignedUrlResponse } from "@nocloud/sdk";
import { ClientRPC } from "./lib/client.rpc";

interface RequestSignedUrlParams {
  contentType: string;
  size: number;
  metadata?: StorageItemMetadata;
}

interface UploadedImage {
  id: string;
  url: string;
}

type RequestSignedUrlResponse =
  | { ok: true; payload: SignedUrlResponse }
  | { ok: false; url: null; message: string };

export class NUIManager {
  private initialized = false;
  private requestIdCounter: number = 0;
  private readonly pendingRequests: Map<
    number,
    { resolve: (value: any) => void; reject: (reason?: any) => void }
  > = new Map();

  constructor(private readonly rpc: ClientRPC) {}

  private handleImageResponse(
    data: { requestId: number; ok: boolean; image: UploadedImage | null },
    cb: Function
  ) {
    const pending = this.pendingRequests.get(data.requestId);

    if (!pending) {
      cb({ ok: false, message: "No pending request found" });
      return;
    }

    this.pendingRequests.delete(data.requestId);
    if (!data.ok) {
      pending.resolve(undefined);
    } else {
      pending.resolve(data.image);
    }
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

      const payload = await this.rpc.requestSignedUrl(data);

      cb({ ok: true, payload });
    } catch (e) {
      cb({ ok: false, url: null, message: (e as Error).message });
    }
  }

  /**
   * Initializes the NUI manager by registering necessary callbacks.
   */
  init() {
    if (this.initialized) return;
    this.initialized = true;

    this.rpc.on<StorageItemMetadata | undefined, UploadedImage>(
      "storage.takeImage",
      this.takeImage.bind(this)
    );

    RegisterNuiCallback("ping", (data: any, cb: Function) =>
      cb({ ok: true, message: "pong" })
    );

    RegisterNuiCallback(
      "storage.requestSignedUrl",
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
    return new Promise<UploadedImage>((resolve, reject) => {
      const requestId = this.requestIdCounter++;

      this.pendingRequests.set(requestId, { resolve, reject });

      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error("Image capture timed out"));
        }
      }, 60_000); // 60 seconds timeout

      SendNUIMessage({
        event: "request.image",
        data: {
          requestId,
          metadata
        }
      });
    });
  }
}
