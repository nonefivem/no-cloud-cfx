export type StorageItemMetadata = Record<string, string | number | boolean>;
export type LoggingLevel = "debug" | "info" | "warn" | "error";

interface RateLimitConfig {
  /** Whether rate limiting is enabled */
  enabled: boolean;
  /** Duration of the rate limiting window in milliseconds */
  window_ms: number;
  /** Maximum number of requests allowed within the window */
  max_requests: number;
  /** Client identifier extractor string */
  client_identifier_extractor: string;
}

interface LoggingConfig {
  /** Whether logging is enabled */
  enabled: boolean;
  /** Log level */
  level: LoggingLevel;
}

interface StorageConfig {
  /** Whether client uploads are enabled */
  enable_client_uploads: boolean;
  /** List of allowed MIME types for uploads */
  allowed_file_types: string[];
  /** Maximum upload file size in megabytes */
  max_file_size_mb: number;
  rate_limit: RateLimitConfig;
}

/** Shared configuration */
export interface Config {
  logging: LoggingConfig;
  storage: StorageConfig;
}
