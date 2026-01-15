import { RPC } from "@common";

export class ServerRPC extends RPC {
  constructor() {
    super();

    // TODO: Implement server-side RPC handlers here
    this.on("request.signedUrl", async (params) => {});
  }
}
