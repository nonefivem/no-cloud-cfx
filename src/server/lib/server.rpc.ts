import { RPC_TIMEOUT, RPCResponse, RPCTimeoutError } from "@common";
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

  private handleResponse<T>(requestId: number, response: RPCResponse<T>) {
    const pending = this.pendingRequests.get(requestId);

    if (!pending) return;

    this.pendingRequests.delete(requestId);

    if (response.success) {
      pending.resolve(response.data);
    } else {
      pending.reject(
        new Error(response.error || `RPC call to requestId ${requestId} failed`)
      );
    }
  }

  /**
   * Make an RPC call from client -> server
   * @param endpoint - endpoint name
   * @param params - parameters to send
   * @returns A promise that resolves with the response
   */
  call<T>(
    endpoint: string,
    source: number,
    payload: Record<string, any>
  ): Promise<T> {
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
    onNet(
      `nocloud.rpc.request.${endpoint}`,
      async (requestId: number, payload: T) => {
        const source = globalThis.source;
        const success = this.rateLimitManager.limit(source);

        if (!success) {
          const response: RPCResponse<R> = {
            success: false,
            error: "Rate limit exceeded"
          };
          emitNet(`nocloud.rpc.response`, source, requestId, response);
          return;
        }

        let response: RPCResponse<R>;

        try {
          const result = await handler(source, payload);
          response = {
            success: true,
            data: result
          };
        } catch (e) {
          console.error(
            `Error handling RPC request for endpoint ${endpoint}:`,
            e
          );
          response = {
            success: false,
            error: (e as Error).message || "Unknown error"
          };
        }

        emitNet(`nocloud.rpc.response`, source, requestId, response);
      }
    );
  }
}
