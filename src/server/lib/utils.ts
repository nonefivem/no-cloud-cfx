import { config } from "@common";

/**
 * Extracts a client identifier based on the configured extractor string.
 * @param player - The player ID to extract identifiers for
 * @returns A string identifier based on the configured extractor (e.g. "ip:license" -> "ip:license_value")
 */
export function extractPlayerIdentifier(player: number): string {
  return config.client_identifier_extractor
    .split(":")
    .map((part) =>
      GetPlayerIdentifierByType(player.toString(), part.toLowerCase())
    )
    .join(":");
}
