import { Logger } from "@common";
import { ClientExportsManager } from "./exports";
import { ClientRPC } from "./lib/client.rpc";
import { NUIManager } from "./nui";

const logger = new Logger("Client");

function main() {
  logger.info("Initializing NoCloud client...");

  const rpc = new ClientRPC();
  const nuiManager = new NUIManager(rpc);
  const exportsManager = new ClientExportsManager(rpc, nuiManager);

  nuiManager.init();
  exportsManager.init();

  logger.info("NoCloud client initialized successfully");
}

main();
