import { RPC, StorageItemMetadata } from "@common";

interface RequestSignedUrlParams {
  contentType: string;
  size: number;
  metadata?: StorageItemMetadata;
}

export class ClientRPC extends RPC {
  /**
   * Requests a signed URL from the server for uploading a file.
   * @param fileName - The name of the file to be uploaded.
   * @param contentType - The MIME type of the file.
   * @param metadata - Optional metadata associated with the file.
   * @returns A promise that resolves with the signed URL.
   */
  requestSignedUrl(payload: RequestSignedUrlParams): Promise<string> {
    return this.call<string>("request.signedUrl", payload);
  }
}
