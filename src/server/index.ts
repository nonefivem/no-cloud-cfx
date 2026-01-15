import { RateLimitManager } from "./lib/rate_limit.manager";
import { ServerRPC } from "./lib/server.rpc";

function main() {
  const rpc = new ServerRPC();
  const rateLimitManager = new RateLimitManager();
}

main();
