const RPC_TIMEOUT = 20_000; // 20 seconds

export class RPCTimeoutError extends Error {
  constructor(endpoint: string) {
    super(
      `RPC call to endpoint "${endpoint}" timed out after ${RPC_TIMEOUT}ms`,
    );
    this.name = "RPCTimeoutError";
  }
}

interface RPCRequest<T = any> {
  requestId: number;
  payload: T;
}

/**
 * Base RPC class for making remote procedure calls between client and server.
 * Handles request tracking, timeouts, and response handling.
 * Only one instance of this class should be created per side (client/server).
 */
export class RPC {
  private requestIdCounter: number = 0;
  private readonly pendingRequests: Map<
    number,
    {
      resolve: (value: any) => void;
      reject: (reason?: any) => void;
    }
  > = new Map();

  constructor() {
    onNet(`no-cloud:rpc:response`, this.handleResponse.bind(this));
  }

  private handleResponse<T>(requestId: number, ok: boolean, response?: T) {
    const pending = this.pendingRequests.get(requestId);

    if (!pending) {
      return;
    }

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
  call<T>(endpoint: string, payload: Record<string, any>): Promise<T> {
    const requestId = this.requestIdCounter++;

    return new Promise<T>((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });

      emitNet(`no-cloud:rpc:request:${endpoint}`, {
        requestId,
        payload,
      } as RPCRequest);

      // Simulate sending the request to the server
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
    handler: (payload: T) => Promise<R>,
  ): Promise<void> {
    onNet(
      `no-cloud:rpc:request:${endpoint}`,
      async ({ requestId, payload }: RPCRequest<T>) => {
        const source = globalThis.source; // Capture the source of the request (it will be undefined on client)

        try {
          const response = await handler(payload);

          if (source) {
            emitNet(`no-cloud:rpc:response`, source, {
              requestId,
              ok: true,
              response,
            });
          } else {
            emitNet(`no-cloud:rpc:response`, { requestId, ok: true, response });
          }
        } catch (e) {
          if (source) {
            emitNet(`no-cloud:rpc:response`, source, {
              requestId,
              ok: false,
            });
          } else {
            emitNet(`no-cloud:rpc:response`, {
              requestId,
              ok: false,
            });
          }
        }
      },
    );
  }
}
