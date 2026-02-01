import NoCloud from "@nocloud/sdk";
import { Logger } from "@common";
import { ServerExportsManager } from "./exports";
import { RateLimitManager } from "./lib/rate_limit.manager";
import { ServerRPC } from "./lib/server.rpc";
import { StorageManager } from "./storage";

import fetch from "node-fetch";

const logger = new Logger("Server");

// Override global fetch for NoCloud SDK
//@ts-ignore
globalThis.fetch = fetch;

function extractApiKey(): string {
  const key = GetConvar("NOCLOUD_API_KEY", "");

  if (!key) {
    logger.error("NoCloud API key is not set in server convars");
    throw new Error("NoCloud API key is not set in server convars");
  }

  logger.debug("API key extracted successfully");
  return key;
}

function main() {
  logger.info("Initializing NoCloud server...");

  const client = new NoCloud(extractApiKey());
  const rateLimitManager = new RateLimitManager();
  const rpc = new ServerRPC(rateLimitManager);
  const storageManager = new StorageManager(client, rpc);
  const exportsManager = new ServerExportsManager(rpc, storageManager);

  exportsManager.init();

  logger.info("NoCloud server initialized successfully");
}

main();
