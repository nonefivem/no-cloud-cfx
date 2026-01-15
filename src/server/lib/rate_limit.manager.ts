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
  clientIdentifier: "ip:license",
};

export class RateLimitManager {
  private readonly limits: Map<string, RateLimit> = new Map();

  constructor(
    private readonly options: RateLimitOptions = DEFAULT_RATE_LIMIT_OPTIONS
  ) {}

  /**
   * Ensures the key is a string identifier.
   * @param key - The key or player server ID.
   * @returns - The string identifier.
   */
  private ensureKey(key: string | number) {
    if (typeof key === "number") {
      key = this.options.clientIdentifier
        .split(":")
        .map((part) =>
          GetPlayerIdentifierByType(key as number, part.toLowerCase())
        )
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
    key = this.ensureKey(key);
    const existing = this.limits.get(key);

    if (existing) {
      const newLevel = existing.current + 1;

      if (newLevel > this.options.maxRequests) {
        return false;
      }

      existing.current = newLevel;
      this.limits.set(key, existing);
      return true;
    }

    const timeout = setTimeout(() => {
      this.limits.delete(key);
    }, this.options.windowMs);

    this.limits.set(key, { timeout, current: 1 });

    return true;
  }

  /**
   * Resets the rate limit for a specific key.
   * @param key - The key or player server ID to reset the rate limit for.
   */
  reset(key: string | number) {
    key = this.ensureKey(key);
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
    this.limits.forEach((limit) => clearTimeout(limit.timeout));
    this.limits.clear();
  }
}
