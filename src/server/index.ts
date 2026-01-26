import NoCloud from "@nocloud/sdk";
import { ServerExportsManager } from "./exports";
import { RateLimitManager } from "./lib/rate_limit.manager";
import { ServerRPC } from "./lib/server.rpc";
import { StorageManager } from "./storage";

import fetch from "node-fetch";

// Override global fetch for NoCloud SDK
//@ts-ignore
globalThis.fetch = fetch;

function extractApiKey(): string {
  const key = GetConvar("NOCLOUD_API_KEY", "");

  if (!key) {
    throw new Error("NoCloud API key is not set in server convars");
  }

  return key;
}

function main() {
  const client = new NoCloud(extractApiKey());
  const rateLimitManager = new RateLimitManager();
  const rpc = new ServerRPC(rateLimitManager);
  const storageManager = new StorageManager(client, rpc);
  const exportsManager = new ServerExportsManager(rpc, storageManager);

  exportsManager.init();
}

main();
