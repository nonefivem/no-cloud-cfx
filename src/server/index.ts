import NoCloud from "@nocloud/sdk";
import { RateLimitManager } from "./lib/rate_limit.manager";
import { ServerRPC } from "./lib/server.rpc";
import { StorageManager } from "./storage";

function main() {
  const client = new NoCloud(GetConvar("NOCLOUD_API_KEY", ""));
  const rateLimitManager = new RateLimitManager();
  const rpc = new ServerRPC(rateLimitManager);
  const storageManager = new StorageManager(client, rpc);
}

main();
