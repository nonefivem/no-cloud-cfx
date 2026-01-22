import { RPC } from "@common";
import { RateLimitManager } from "./rate_limit.manager";

export class ServerRPC extends RPC {
  constructor(private readonly rateLimitManager: RateLimitManager) {
    super();
  }

  override async on<T = any, R = any>(
    endpoint: string,
    handler: (payload: T) => Promise<R>,
  ): Promise<void> {
    await super.on(endpoint, async (payload: T) => {
      const source = globalThis.source as number;
      const canProceed = this.rateLimitManager.limit(source);

      if (!canProceed) {
        throw new Error("Rate limit exceeded");
      }

      return handler(payload);
    });
  }
}
