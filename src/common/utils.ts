import { config } from "./config";
import { StorageItemMetadata } from "./types";

/** List of identifiers that should always be masked */
const masked_identifiers = ["ip"];

/**
 * Masks an identifier value if its type is in the masked_identifiers list or configured masked identifiers.
 * @param identifier The identifier value to potentially mask (e.g. an IP address)
 * @param type The type of the identifier (e.g. "ip", "license", "steam") used to determine if it should be masked
 * @returns The original identifier value or a masked version if it should be masked for privacy
 */
function maskIdentifier(identifier: string, type: string): string {
  if (
    masked_identifiers.includes(type) ||
    config.storage.metadata_attachments.masked_identifiers.includes(type)
  ) {
    return "****." + identifier.slice(-4); // Mask all but last 4 characters for privacy
  }
  return identifier;
}

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
      return mask ? maskIdentifier(identifier, part.toLowerCase()) : identifier;
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
