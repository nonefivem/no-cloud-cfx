import { config } from "@common";

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
