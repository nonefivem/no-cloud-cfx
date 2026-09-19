import { type FlagValues, Logger, type StorageItemMetadata } from "@common";
import type { JsonValue, SignedUrlResponse } from "@nocloud/sdk";
import type { ClientFlagsManager } from "./flags";
import { ClientRPC, RequestSignedUrlParams } from "./lib/client.rpc";

interface UploadedImage {
  id: string;
  url: string;
}

type RequestSignedUrlResponse =
  | { ok: true; payload: SignedUrlResponse }
  | { ok: false; url: null; message: string };

/** What the NUI sends when reading one flag. */
interface FlagReadRequest {
  key?: string;
  fallback?: JsonValue;
}

type NuiResponse<T> = { ok: true; payload: T } | { ok: false; message: string };

export class NUIManager {
  private readonly logger = new Logger("NUIManager");
  private initialized = false;
  private requestIdCounter: number = 0;
  private readonly pendingRequests: Map<
    number,
    { resolve: (value: any) => void; reject: (reason?: any) => void }
  > = new Map();

  constructor(
    private readonly rpc: ClientRPC,
    private readonly flags: ClientFlagsManager
  ) {}

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
      if (data.contentType != null && data.size != null) {
        this.logger.debug(
          `Requesting pre-allocated signed URL for ${data.contentType} (${data.size} bytes)`
        );
      } else {
        this.logger.debug("Requesting non-allocated signed URL");
      }

      const payload = await this.rpc.requestSignedUrl(data);

      this.logger.debug("Signed URL received successfully");
      cb({ ok: true, payload });
    } catch (e) {
      this.logger.error(
        `Failed to request signed URL: ${(e as Error).message}`
      );
      cb({ ok: false, url: null, message: (e as Error).message });
    }
  }

  /**
   * Answers the NUI with every flag this client holds.
   *
   * Reading through here is a read like any other - it keeps this client
   * counted as a flag reader, so the values the NUI sees stay current.
   */
  private handleGetFlags(_data: unknown, cb: (r: NuiResponse<FlagValues>) => void) {
    cb({ ok: true, payload: this.flags.getFlags() });
  }

  /**
   * Answers the NUI with one flag's value, whatever its type.
   *
   * A missing flag answers with the fallback the NUI sent, or null - the same
   * rule the exports follow, so a flag archived in the dashboard never breaks
   * a UI.
   */
  private handleGetFlagValue(
    data: FlagReadRequest,
    cb: (r: NuiResponse<JsonValue | null>) => void
  ) {
    if (!data?.key) {
      cb({ ok: false, message: "A flag key is required" });
      return;
    }

    // undefined does not survive the trip back through JSON, so absent is null.
    cb({
      ok: true,
      payload: this.flags.getFlagValue(data.key, data.fallback) ?? null
    });
  }

  /**
   * Answers the NUI whether a boolean flag is on.
   */
  private handleIsFlagEnabled(
    data: FlagReadRequest,
    cb: (r: NuiResponse<boolean>) => void
  ) {
    if (!data?.key) {
      cb({ ok: false, message: "A flag key is required" });
      return;
    }

    cb({
      ok: true,
      payload: this.flags.isEnabled(data.key, data.fallback === true)
    });
  }

  /**
   * Answers the NUI whether the server has published any flags yet.
   */
  private handleAreFlagsReady(
    _data: unknown,
    cb: (r: NuiResponse<boolean>) => void
  ) {
    cb({ ok: true, payload: this.flags.ready });
  }

  /**
   * Pushes new values to the NUI, so a UI showing a flag does not have to poll
   * for one to change.
   */
  private handleFlagsChanged(values: FlagValues) {
    this.logger.debug("Forwarding changed feature flags to the NUI");

    SendNUIMessage({ event: "flags.updated", data: { flags: values } });
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

    RegisterNuiCallback("flags.getFlags", this.handleGetFlags.bind(this));
    RegisterNuiCallback(
      "flags.getFlagValue",
      this.handleGetFlagValue.bind(this)
    );
    RegisterNuiCallback(
      "flags.isFlagEnabled",
      this.handleIsFlagEnabled.bind(this)
    );
    RegisterNuiCallback(
      "flags.areFlagsReady",
      this.handleAreFlagsReady.bind(this)
    );

    this.flags.watch(this.handleFlagsChanged.bind(this));
  }

  /**
   * Takes an image using the NUI and returns the result.
   * @param metadata - Optional metadata for the image.
   * @returns A promise that resolves with the image data URL or an error.
   */
  takeImage(metadata?: StorageItemMetadata) {
    return new Promise<UploadedImage>((resolve, reject) => {
      const requestId = this.requestIdCounter++;

      this.logger.debug(`Taking image with requestId: ${requestId}`);
      this.pendingRequests.set(requestId, { resolve, reject });

      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          this.logger.warn(
            `Image capture timed out for requestId: ${requestId}`
          );
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
