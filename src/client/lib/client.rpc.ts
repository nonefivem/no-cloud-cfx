import { RPC_TIMEOUT, RPCTimeoutError, StorageItemMetadata } from "@common";
import { SignedUrlResponse } from "@nocloud/sdk";

interface RequestSignedUrlParams {
  contentType: string;
  size: number;
  metadata?: StorageItemMetadata;
}

export class ClientRPC {
  private readonly pendingRequests: Map<
    number,
    { resolve: (value: any) => void; reject: (reason?: any) => void }
  > = new Map();
  private requestIdCounter: number = 0;

  private handleResponse<T>(requestId: number, ok: boolean, response?: T) {
    const pending = this.pendingRequests.get(requestId);

    if (!pending) return;

    this.pendingRequests.delete(requestId);

    if (ok) {
      pending.resolve(response);
    } else {
      pending.reject(new Error(`RPC call to requestId ${requestId} failed`));
    }
  }

  constructor() {
    onNet(`nocloud.rpc.response`, this.handleResponse.bind(this));
  }

  /**
   * Make an RPC call from client -> server
   * @param endpoint - endpoint name
   * @param params - parameters to send
   * @returns A promise that resolves with the response
   */
  call<T>(endpoint: string, payload: Record<string, any>): Promise<T> {
    const requestId = this.requestIdCounter++;

    return new Promise<T>((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });

      emitNet(`nocloud.rpc.request.${endpoint}`, requestId, payload);

      setTimeout(() => {
        const pending = this.pendingRequests.get(requestId);

        if (pending) {
          this.pendingRequests.delete(requestId);
          pending.reject(new RPCTimeoutError(endpoint));
        }
      }, RPC_TIMEOUT);
    });
  }

  async on<T = any, R = any>(
    endpoint: string,
    handler: (payload: T) => Promise<R>
  ): Promise<void> {
    onNet(`nocloud.rpc.request.${endpoint}`, async (requestId: number, payload: T) => {
      let ok = true;
      let response: R | undefined = undefined;

      try {
        response = await handler(payload);
      } catch (e) {
        ok = false;
      } finally {
        emitNet(`nocloud.rpc.response`, requestId, ok, response);
      }
    });
  }

  /**
   * Requests a signed URL from the server for uploading a file.
   * @param fileName - The name of the file to be uploaded.
   * @param contentType - The MIME type of the file.
   * @param metadata - Optional metadata associated with the file.
   * @returns A promise that resolves with the signed URL.
   */
  requestSignedUrl(payload: RequestSignedUrlParams): Promise<SignedUrlResponse> {
    return this.call<SignedUrlResponse>("storage.requestSignedUrl", payload);
  }
}
