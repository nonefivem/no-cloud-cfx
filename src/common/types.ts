export type StorageItemMetadata = Record<string, string | number | boolean>;
export type LoggingLevel = "debug" | "info" | "warn" | "error";

interface LoggingConfig {
  enabled: boolean;
  level: LoggingLevel;
}

interface StorageConfig {
  enable_client_uploads: boolean;
  allowed_file_types: string[];
  max_file_size_mb: number;
  rate_limit: {
    enabled: boolean;
    client_uploads_per_minute: number;
    client_identifier_extractor: string;
  };
}

export interface Config {
  logging: LoggingConfig;
  storage: StorageConfig;
}
