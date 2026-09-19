import { Logger } from "@common";
import { ClientExportsManager } from "./exports";
import { ClientFlagsManager } from "./flags";
import { ClientRPC } from "./lib/client.rpc";
import { NUIManager } from "./nui";

const logger = new Logger("Client");

function main() {
  logger.info("Initializing NoCloud client...");

  const rpc = new ClientRPC();
  const flagsManager = new ClientFlagsManager();
  const nuiManager = new NUIManager(rpc, flagsManager);
  const exportsManager = new ClientExportsManager(rpc, nuiManager, flagsManager);

  nuiManager.init();
  exportsManager.init();
  flagsManager.init();

  logger.info("NoCloud client initialized successfully");
}

main();
