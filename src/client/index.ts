import { ExportsManager } from "./exports";
import { ClientRPC } from "./lib/client.rpc";
import { NUIManager } from "./nui";

function main() {
  const rpc = new ClientRPC();
  const nuiManager = new NUIManager(rpc);
  const exportsManager = new ExportsManager(rpc, nuiManager);

  nuiManager.init();
  exportsManager.init();
}

main();
