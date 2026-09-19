import { Config } from "./types";

const DEFAULT_CONFIG: Config = {
  client_identifier_extractor: "ip:license",
  logging: {
    enabled: true,
    level: "info"
  },
  storage: {
    enable_client_uploads: true,
    max_file_size_mb: 50,
    allowed_file_types: [
      "text/plain",
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
      "video/mp4",
      "video/webm",
      "audio/mpeg",
      "audio/wav"
    ],
    metadata_attachments: {
      masked_identifiers: ["ip"],
      resource: true,
      player: true
    },
    rate_limit: {
      enabled: true,
      window_ms: 60000,
      max_requests: 20
    }
  },
  flags: {
    enabled: true,
    cache_ttl_seconds: 10,
    global_state_key: "nocloud_flags",
    persist_last_known: true,
    polling: {
      enabled: false,
      interval_ms: 60000
    }
  }
};

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Overlays a loaded configuration onto the defaults.
 *
 * A section the file does not mention keeps its default rather than reading as
 * undefined, so a config.json written against an older release keeps working
 * after an update instead of crashing on the options it predates.
 *
 * @param defaults - The built-in configuration
 * @param loaded - What was parsed out of config.json
 */
function mergeConfig<T>(defaults: T, loaded: unknown): T {
  if (!isPlainObject(loaded) || !isPlainObject(defaults)) {
    return (loaded === undefined ? defaults : (loaded as T));
  }

  const merged: PlainObject = { ...defaults };

  for (const [key, value] of Object.entries(loaded)) {
    if (value === undefined) continue;

    merged[key] = isPlainObject(value)
      ? mergeConfig(defaults[key], value)
      : value;
  }

  return merged as T;
}

function loadConfig(): Config {
  try {
    const config = LoadResourceFile(GetCurrentResourceName(), "config.json");

    if (!config) {
      throw new Error("Configuration file not found");
    }

    return mergeConfig(DEFAULT_CONFIG, JSON.parse(config));
  } catch (error) {
    console.warn(
      "[NoCloud] [WARN]: Could not load config.json, using default configuration.",
      (error as Error).message
    );
    // Return defaults if config file doesn't exist
    return DEFAULT_CONFIG;
  }
}

export const config = loadConfig();
