import { Logger } from "@common";
import { extractPlayerIdentifier } from "../../common/utils";

interface RateLimit {
  timeout: NodeJS.Timeout;
  current: number;
}

interface RateLimiterOptions {
  name: string;
  maxRequests: number;
  windowMs: number;
  clientIdentifier: string;
}

const DEFAULT_RATE_LIMIT_OPTIONS: RateLimiterOptions = {
  name: "default",
  maxRequests: 10,
  windowMs: 60000, // 1 minute
  clientIdentifier: "ip:license"
};

export class RateLimiter {
  private readonly logger: Logger;
  private readonly limits: Map<string, RateLimit> = new Map();

  constructor(private readonly options: RateLimiterOptions = DEFAULT_RATE_LIMIT_OPTIONS) {
    this.logger = new Logger(`RateLimiter<${this.options.name}>`);
  }

  /**
   * Resolves the client identifier string based on the provided key.
   * @param key - The key or player server ID.
   * @returns - The string identifier.
   */
  private resolveClientIdentifier(key: string | number) {
    if (typeof key === "number") {
      key = extractPlayerIdentifier(key);
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
