export const RPC_TIMEOUT = 20_000; // 20 seconds

export class RPCTimeoutError extends Error {
  constructor(endpoint: string) {
    super(
      `RPC call to endpoint "${endpoint}" timed out after ${RPC_TIMEOUT}ms`
    );
    this.name = "RPCTimeoutError";
  }
}

export type RPCResponse<T = any> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: string;
    };

export interface ServerToClientRPC {}
