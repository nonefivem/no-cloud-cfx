import { RPCTimeoutError, RPC_TIMEOUT } from "@common";
import { RateLimitManager } from "./rate_limit.manager";

export class ServerRPC {
  private readonly pendingRequests: Map<
    number,
    { resolve: (value: any) => void; reject: (reason?: any) => void }
  > = new Map();
  private requestIdCounter: number = 0;

  constructor(private readonly rateLimitManager: RateLimitManager) {
    onNet(`nocloud.rpc.response`, this.handleResponse.bind(this));
  }

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

  /**
   * Make an RPC call from client -> server
   * @param endpoint - endpoint name
   * @param params - parameters to send
   * @returns A promise that resolves with the response
   */
  call<T>(endpoint: string, source: number, payload: Record<string, any>): Promise<T> {
    const requestId = this.requestIdCounter++;

    return new Promise<T>((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });

      emitNet(`nocloud.rpc.request.${endpoint}`, source, requestId, payload);

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
    handler: (source: number, payload: T) => Promise<R>
  ): Promise<void> {
    onNet(`nocloud.rpc.request.${endpoint}`, async (requestId: number, payload: T) => {
      const source = globalThis.source;
      const success = this.rateLimitManager.limit(source);

      if (!success) {
        emitNet(`nocloud.rpc.response`, source, requestId, false);
        return;
      }

      let ok = true;
      let response: R | undefined = undefined;

      try {
        response = await handler(source, payload);
      } catch (e) {
        ok = false;
      } finally {
        emitNet(`nocloud.rpc.response`, source, requestId, ok, response);
      }
    });
  }
}
