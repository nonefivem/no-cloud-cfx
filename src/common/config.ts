import { Config } from "./types";

function loadConfig(): Config {
  try {
    const config = LoadResourceFile(GetCurrentResourceName(), "config.json");

    if (!config) {
      throw new Error("Configuration file not found");
    }

    return JSON.parse(config) as Config;
  } catch (error) {
    console.warn(
      "[NoCloud] [WARN]: Could not load config.json, using default configuration.",
      (error as Error).message
    );
    // Return defaults if config file doesn't exist
    return {
      logging: {
        enabled: true,
        level: "info"
      },
      storage: {
        enable_client_uploads: true,
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
        max_file_size_mb: 50,
        rate_limit: {
          enabled: true,
          window_ms: 60000,
          max_requests: 20,
          client_identifier_extractor: "ip:license"
        }
      }
    };
  }
}

export const config = loadConfig();
