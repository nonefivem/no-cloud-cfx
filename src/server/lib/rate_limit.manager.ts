import { Logger } from "@common";

interface RateLimit {
  timeout: NodeJS.Timeout;
  current: number;
}

interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
  clientIdentifier: string;
}

const DEFAULT_RATE_LIMIT_OPTIONS: RateLimitOptions = {
  maxRequests: 10,
  windowMs: 60000, // 1 minute
  clientIdentifier: "ip:license"
};

export class RateLimitManager {
  private readonly logger = new Logger("RateLimitManager");
  private readonly limits: Map<string, RateLimit> = new Map();

  constructor(private readonly options: RateLimitOptions = DEFAULT_RATE_LIMIT_OPTIONS) {}

  /**
   * Resolves the client identifier string based on the provided key.
   * @param key - The key or player server ID.
   * @returns - The string identifier.
   */
  private resolveClientIdentifier(key: string | number) {
    if (typeof key === "number") {
      key = this.options.clientIdentifier
        .split(":")
        .map(part => GetPlayerIdentifierByType(key.toString(), part.toLowerCase()))
        .join(":");
    }

    return key;
  }

  /**
   * Attempts to apply a rate limit for a specific key.
   * @param key - The key or player server ID to apply the rate limit to.
   * @returns - True if the request is allowed, false if rate limit exceeded.
   */
  limit(key: string | number): boolean {
    key = this.resolveClientIdentifier(key);
    const existing = this.limits.get(key);

    if (existing) {
      const newLevel = existing.current + 1;

      if (newLevel > this.options.maxRequests) {
        this.logger.warn(`Rate limit exceeded for key: ${key}`);
        return false;
      }

      existing.current = newLevel;
      this.limits.set(key, existing);
      this.logger.debug(
        `Rate limit incremented for key: ${key} (${newLevel}/${this.options.maxRequests})`
      );
      return true;
    }

    const timeout = setTimeout(() => {
      this.limits.delete(key);
      this.logger.debug(`Rate limit window expired for key: ${key}`);
    }, this.options.windowMs);

    this.limits.set(key, { timeout, current: 1 });
    this.logger.debug(
      `Rate limit started for key: ${key} (1/${this.options.maxRequests})`
    );

    return true;
  }

  /**
   * Resets the rate limit for a specific key.
   * @param key - The key or player server ID to reset the rate limit for.
   */
  reset(key: string | number) {
    key = this.resolveClientIdentifier(key);
    const existing = this.limits.get(key);

    if (existing) {
      clearTimeout(existing.timeout);
      this.limits.delete(key);
    }
  }

  /**
   * Clears all rate limits.
   */
  clear() {
    this.limits.forEach(limit => clearTimeout(limit.timeout));
    this.limits.clear();
  }
}
