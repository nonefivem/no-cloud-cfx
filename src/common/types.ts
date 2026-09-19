export type StorageItemMetadata = Record<string, string | number | boolean>;
export type LoggingLevel = "debug" | "info" | "warn" | "error";

interface RateLimitConfig {
  /** Whether rate limiting is enabled */
  enabled: boolean;
  /** Duration of the rate limiting window in milliseconds */
  window_ms: number;
  /** Maximum number of requests allowed within the window */
  max_requests: number;
}

interface LoggingConfig {
  /** Whether logging is enabled */
  enabled: boolean;
  /** Log level */
  level: LoggingLevel;
}

interface MetadataAttachmentConfig {
  /** List of client identifiers to mask in metadata (ip is always masked, e.g. ip, license, steam) */
  masked_identifiers: string[];
  /** Whether to attach resource name to file metadata */
  resource: boolean;
  /** Whether to attach player identifier to file metadata */
  player: boolean;
}

interface FlagPollingConfig {
  /** Whether the flags are refetched on the interval whether or not a client is reading them */
  enabled: boolean;
  /** How often they are refetched, in milliseconds */
  interval_ms: number;
}

interface FlagsConfig {
  /** Whether feature flags are available at all */
  enabled: boolean;
  /** How long a fetched configuration is served from memory before a read goes back to the API, in seconds */
  cache_ttl_seconds: number;
  /** GlobalState key the shared flag values are published under, which is how clients read them */
  global_state_key: string;
  /** Whether the last received flags are kept in resource storage and served on the next start, and while the API is unreachable */
  persist_last_known: boolean;
  /** Background polling configuration */
  polling: FlagPollingConfig;
}

interface StorageConfig {
  /** Whether client uploads are enabled */
  enable_client_uploads: boolean;
  /** List of allowed MIME types for uploads */
  allowed_file_types: string[];
  /** Maximum upload file size in megabytes */
  max_file_size_mb: number;
  /** Rate limiting configuration */
  rate_limit: RateLimitConfig;
  /** Metadata attachment configuration */
  metadata_attachments: MetadataAttachmentConfig;
}

/** Shared configuration */
export interface Config {
  /** Client identifier extractor string */
  client_identifier_extractor: string;
  logging: LoggingConfig;
  storage: StorageConfig;
  flags: FlagsConfig;
}
