import { config } from "./config";
import { StorageItemMetadata } from "./types";

const masked_identifiers = ["ip"];

/**
 * Extracts a client identifier based on the configured extractor string.
 * @param player - The player ID to extract identifiers for
 * @param mask - Whether to mask the values of certain identifiers (e.g. IP addresses) for privacy
 * @returns A string identifier based on the configured extractor (e.g. "ip:license" -> "ip:license_value")
 */
export function extractPlayerIdentifier(player: number, mask = false): string {
  return config.client_identifier_extractor
    .split(":")
    .map((part) => {
      const identifier = GetPlayerIdentifierByType(
        player.toString(),
        part.toLowerCase()
      );
      return mask && masked_identifiers.includes(part.toLowerCase())
        ? "****"
        : identifier;
    })
    .join(":");
}

export function populateMetadataAttachments(
  metadata?: StorageItemMetadata,
  player_id?: number
): StorageItemMetadata | undefined {
  if (config.storage.metadata_attachments.resource) {
    metadata = metadata || {};
    metadata.resource = metadata.resource || GetInvokingResource();
  }

  if (player_id && config.storage.metadata_attachments.player) {
    metadata = metadata || {};
    metadata.player =
      metadata.player || extractPlayerIdentifier(player_id, true);
  }

  return metadata;
}
