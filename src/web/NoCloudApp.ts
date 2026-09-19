import {
  OrthographicCamera,
  Scene,
  WebGLRenderTarget,
  LinearFilter,
  NearestFilter,
  RGBAFormat,
  UnsignedByteType,
  CfxTexture,
  ShaderMaterial,
  PlaneBufferGeometry,
  Mesh,
  WebGLRenderer
} from "@citizenfx/three";

type StorageItemMetadata = Record<string, string | number | boolean>;

/**
 * A feature flag's value. Flags hold booleans, strings, numbers or JSON.
 */
type FlagValue = string | number | boolean | null | FlagValue[] | { [key: string]: FlagValue };

/**
 * Feature flags keyed by flag key - every flag this client holds.
 */
export type FlagValues = Record<string, FlagValue>;

/**
 * NUI Message from client
 */
interface NuiMessage {
  event: string;
  data?: {
    requestId?: number;
    metadata?: StorageItemMetadata;
    flags?: FlagValues;
  };
}

/**
 * Reply to a flag read, from the client
 */
type FlagResponse<T> = { ok: true; payload: T } | { ok: false; message: string };

/**
 * Signed URL request to client
 */
interface SignedUrlRequest {
  contentType: string;
  size: number;
  metadata?: StorageItemMetadata;
}

/**
 * Signed URL response from client
 */
type SignedUrlResponse =
  | {
      ok: true;
      payload: {
        url: string;
        mediaId: string;
        mediaUrl: string;
      };
    }
  | {
      ok: false;
      payload: null;
    };

/**
 * Image request pending in queue
 */
interface PendingImageRequest {
  requestId: number;
  metadata?: StorageItemMetadata;
}

/**
 * Convert data URI to Blob for upload
 */
function dataURItoBlob(dataURI: string): Blob {
  const byteString = atob(dataURI.split(",")[1]);
  const mimeString = dataURI.split(",")[0].split(":")[1].split(";")[0];

  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);

  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }

  return new Blob([ab], { type: mimeString });
}

/**
 * Get the game texture as ImageData using CfxTexture
 */
function getGameTexture(): ImageData {
  const cameraRTT: any = new OrthographicCamera(
    window.innerWidth / -2,
    window.innerWidth / 2,
    window.innerHeight / 2,
    window.innerHeight / -2,
    -10000,
    10000
  );

  const sceneRTT: any = new Scene();

  const rtTexture = new WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    minFilter: LinearFilter,
    magFilter: NearestFilter,
    format: RGBAFormat,
    type: UnsignedByteType
  });

  const gameTexture: any = new CfxTexture();
  gameTexture.needsUpdate = true;

  const material = new ShaderMaterial({
    uniforms: { tDiffuse: { value: gameTexture } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = vec2(uv.x, 1.0-uv.y);
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D tDiffuse;
      void main() {
        gl_FragColor = texture2D( tDiffuse, vUv );
      }`
  });

  const plane = new PlaneBufferGeometry(window.innerWidth, window.innerHeight);
  const quad: any = new Mesh(plane, material);
  quad.position.z = -100;
  sceneRTT.add(quad);

  const renderer = new WebGLRenderer();
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.autoClear = false;

  renderer.render(sceneRTT, cameraRTT, rtTexture, true);

  const read = new Uint8Array(window.innerWidth * window.innerHeight * 4);
  renderer.readRenderTargetPixels(
    rtTexture,
    0,
    0,
    window.innerWidth,
    window.innerHeight,
    read
  );

  const d = new Uint8ClampedArray(read.buffer);
  return new ImageData(d, window.innerWidth, window.innerHeight);
}

/**
 * NoCloudApp - Base class for FiveM NUI screenshot capture
 * Uses WebGL to capture the game view via CfxTexture
 */
export abstract class NoCloudApp {
  private resourceName: string;

  constructor() {
    this.resourceName = this.getResourceName();
    this.setupNuiListener();
    this.init();
    // Warm up the texture to avoid black screenshots on first attempt
    setTimeout(getGameTexture, 1000);
  }

  /**
   * Get the current resource name from the window object
   */
  private getResourceName(): string {
    return (window as any).GetParentResourceName?.() ?? "no-cloud";
  }

  /**
   * Initialize the application - override in subclass
   */
  protected abstract init(): void;

  /**
   * Send NUI callback to client
   */
  private async nuiCallback<T>(event: string, data: any): Promise<T> {
    const response = await fetch(`https://${this.resourceName}/${event}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return response.json();
  }

  /**
   * Setup the main NUI message listener
   */
  private setupNuiListener(): void {
    window.addEventListener("message", (event: MessageEvent<NuiMessage>) => {
      const data = event.data.data;

      if (event.data.event === "request.image" && data?.requestId !== undefined) {
        this.handleImageRequest({
          requestId: data.requestId,
          metadata: data.metadata
        });
      }

      if (event.data.event === "flags.updated") {
        this.onFlagsUpdated(data?.flags ?? {});
      }
    });
  }

  /**
   * Called when the feature flags change, with every flag this client holds.
   *
   * Override to react - the client pushes this rather than the UI polling for
   * it. A change reaches here once the server notices it, which needs something
   * keeping the flags current: this UI reading them, or `polling.enabled` on
   * the server.
   *
   * @param flags - Every flag this client holds
   */
  protected onFlagsUpdated(flags: FlagValues): void {
    void flags;
  }

  /**
   * Read every feature flag this client holds.
   *
   * The values come from the client script's copy of replicated state, so this
   * is a local round trip rather than a request to anything - cheap, but not
   * free. Read once and keep what you need rather than reading per frame, and
   * override {@link onFlagsUpdated} to hear about changes.
   *
   * @returns Every flag, keyed by flag key
   */
  protected async getFlags(): Promise<FlagValues> {
    const response = await this.nuiCallback<FlagResponse<FlagValues>>(
      "flags.getFlags",
      {}
    );

    return response.ok ? response.payload : {};
  }

  /**
   * Read one feature flag's value, whatever its type.
   * @param key - The flag's key
   * @param fallback - Returned when the flag is missing or unreadable
   * @returns The flag's value, or the fallback
   */
  protected async getFlagValue(
    key: string,
    fallback: FlagValue = null
  ): Promise<FlagValue> {
    const response = await this.nuiCallback<FlagResponse<FlagValue>>(
      "flags.getFlagValue",
      { key, fallback }
    );

    return response.ok ? response.payload : fallback;
  }

  /**
   * Check whether a boolean feature flag is on.
   *
   * A missing flag, or one holding another type, reads as the fallback - so a
   * flag archived in the dashboard can never break this UI.
   *
   * @param key - The flag's key
   * @param fallback - Returned when the flag is not a readable boolean flag
   * @returns Whether the flag is on
   */
  protected async isFlagEnabled(key: string, fallback = false): Promise<boolean> {
    const response = await this.nuiCallback<FlagResponse<boolean>>(
      "flags.isFlagEnabled",
      { key, fallback }
    );

    return response.ok ? response.payload : fallback;
  }

  /**
   * Whether the server has published any flags yet.
   * @returns Whether there are flags to read
   */
  protected async areFlagsReady(): Promise<boolean> {
    const response = await this.nuiCallback<FlagResponse<boolean>>(
      "flags.areFlagsReady",
      {}
    );

    return response.ok && response.payload;
  }

  /**
   * Capture the current game view as a data URL
   */
  private captureImage(): string {
    const gameTexture = getGameTexture();

    const canvas = document.createElement("canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get canvas context");

    ctx.putImageData(gameTexture, 0, 0);

    return canvas.toDataURL("image/jpeg", 0.92);
  }

  /**
   * Handle image request from client
   */
  private async handleImageRequest(request: PendingImageRequest): Promise<void> {
    try {
      // Capture the screenshot
      const dataUrl = this.captureImage();
      const blob = dataURItoBlob(dataUrl);

      // Request signed URL from client
      const signedUrlResponse = await this.nuiCallback<SignedUrlResponse>(
        "storage.requestSignedUrl",
        {
          contentType: blob.type,
          size: blob.size,
          metadata: request.metadata
        } as SignedUrlRequest
      );

      if (!signedUrlResponse.ok) {
        await this.nuiCallback("response.image", {
          requestId: request.requestId,
          ok: false,
          image: null
        });
        return;
      }

      const payload = signedUrlResponse.payload;

      // Upload to signed URL
      const uploadResponse = await fetch(payload.url, {
        method: "PUT",
        body: blob
      });

      if (!uploadResponse.ok) {
        await this.nuiCallback("response.image", {
          requestId: request.requestId,
          ok: false,
          image: null
        });
        return;
      }

      await this.nuiCallback("response.image", {
        requestId: request.requestId,
        ok: true,
        image: {
          id: payload.mediaId,
          url: payload.mediaUrl
        }
      });
    } catch (error) {
      await this.nuiCallback("response.image", {
        requestId: request.requestId,
        ok: false,
        image: null
      });
    }
  }
}
