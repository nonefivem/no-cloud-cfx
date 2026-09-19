import {
  config,
  FLAG_EVENTS,
  FlagCache,
  FlagChange,
  FlagValues,
  Logger
} from "@common";
import type {
  FeatureFlagRuntime,
  FlagConfigEntry,
  FlagConfigPayload,
  JsonValue,
  NoCloud
} from "@nocloud/sdk";
import { FlagStore } from "./lib/flag.store";
import { RateLimiter } from "./lib/rate.limiter";

/**
 * Floor for the configured polling interval.
 *
 * Refreshing faster than this spends requests without telling you anything new -
 * a flag change takes effect on the next poll either way.
 */
const MIN_POLLING_INTERVAL_MS = 10_000;

/** Key the last-known snapshot is kept under in resource storage. */
const STORE_KEY = "flags";

/** How often a single player may announce itself as a flag reader. */
const USE_RATE_LIMIT = { maxRequests: 5, windowMs: 60_000 };

/**
 * Holds the server's feature flags and keeps them current.
 *
 * A read serves the configuration the SDK holds and goes to the API only when
 * that has aged past the cache window, so a read is usually free and never more
 * than one request per window.
 *
 * Polling is for clients, and by default runs only while there are any. A
 * client reads replicated state, which the server cannot observe and cannot
 * refresh on demand, so a client that is reading says so and stops saying so
 * once it has gone quiet; polling runs from the first of those until the last
 * one leaves or falls silent. A server whose players never read a flag fetches
 * once, to fill the state bag, and then leaves the API alone. Configuration can
 * turn polling on outright, for a resource that watches rather than reads.
 *
 * The server is the trusted side: it holds the API key and receives every flag,
 * server-only ones included. Only the `shared` ones are published to
 * GlobalState, which is how they reach players - and the only way they do.
 */
export class FlagsManager {
  private readonly logger = new Logger("FlagsManager");
  private readonly cache = new FlagCache("server");
  private readonly store = new FlagStore(
    STORE_KEY,
    config.flags.persist_last_known
  );
  private readonly rateLimiter = new RateLimiter({
    name: "flags",
    clientIdentifier: config.client_identifier_extractor,
    maxRequests: USE_RATE_LIMIT.maxRequests,
    windowMs: USE_RATE_LIMIT.windowMs
  });

  /** Players whose clients read flags, and so need them kept current. */
  private readonly subscribers = new Set<number>();

  private initialized = false;
  /** Whether the refresh loop is running, fetch in flight included. */
  private running = false;
  private timer?: ReturnType<typeof setTimeout>;
  /** Cuts the wait between turns short, so the loop can stop promptly. */
  private wake?: () => void;
  /** The shared values as last written to the state bag. */
  private published?: string;
  private advisedIntervalWarned = false;
  /** When the configuration was last asked for, successfully or not. */
  private fetchedAt?: number;

  constructor(private readonly client: NoCloud) {}

  /**
   * Whether flags may be read at all on this server.
   */
  get enabled(): boolean {
    return config.flags.enabled;
  }

  /**
   * Whether values are available to read. False only before the first fetch
   * answers with no cached snapshot to fall back on.
   */
  get ready(): boolean {
    return this.cache.isReady();
  }

  /**
   * Whether the values being served came from the last-known cache rather than
   * from a fetch - true on a restart until the first read or poll answers, and
   * for as long as the API stays unreachable after that.
   */
  get stale(): boolean {
    return this.cache.isStale();
  }

  /**
   * The interval between background refreshes.
   */
  private get pollingIntervalMs(): number {
    return Math.max(config.flags.polling.interval_ms, MIN_POLLING_INTERVAL_MS);
  }

  /**
   * Whether the held configuration is still inside the cache window.
   *
   * Set even when a fetch fails, so an API that is down costs one attempt per
   * window rather than one per read or per poll.
   */
  private get fresh(): boolean {
    return (
      this.fetchedAt !== undefined &&
      Date.now() - this.fetchedAt < config.flags.cache_ttl_seconds * 1000
    );
  }

  /**
   * Whether the flags are being kept current.
   *
   * Either a client is reading them, or the configuration says to keep them
   * current regardless - which is what a resource watching the state bag or the
   * change event needs, since neither of those is a read anyone can see.
   */
  private get polls(): boolean {
    if (!this.enabled) return false;

    return config.flags.polling.enabled || this.subscribers.size > 0;
  }

  /** How many clients are reading the flags. */
  get subscriberCount(): number {
    return this.subscribers.size;
  }

  /** Whether the flags are being refreshed in the background right now. */
  get polling(): boolean {
    return this.running;
  }

  /* ----------------------------- Subscribers ------------------------------ */

  /**
   * Takes a player's word for it that their client reads flags.
   *
   * A client says this on the read that finds it unsubscribed. Until one does,
   * nothing polls - server-side reads refresh themselves and have no use for a
   * loop.
   */
  private addSubscriber(player: number): void {
    if (!this.enabled || this.subscribers.has(player)) return;

    if (!this.rateLimiter.limit(player)) return;

    this.subscribers.add(player);
    this.logger.debug(
      `Player ${player} reads feature flags (${this.subscribers.size} subscriber(s))`
    );

    this.startPolling();
  }

  /**
   * Drops a player who has left or stopped reading, and stops polling with the
   * last of them.
   */
  private removeSubscriber(player: number): void {
    if (!this.subscribers.delete(player)) return;

    // Still polling, either for the clients that are left or because the
    // configuration asks for it regardless.
    if (this.polls) {
      this.logger.debug(
        `Player ${player} no longer reads feature flags (${this.subscribers.size} subscriber(s))`
      );
      return;
    }

    this.stopPolling();
    this.logger.info(
      "No client is reading feature flags, stopped keeping them current"
    );
  }

  /* --------------------------------- Setup -------------------------------- */

  /**
   * Publishes whatever was cached last time, and makes sure clients have
   * something to read.
   *
   * A restart costs no request at all - the stored snapshot fills GlobalState
   * on the first tick. Only a server with nothing stored fetches here, because
   * clients read the state bag and cannot fill it themselves, and a bag nobody
   * has filled reads as no flags at all.
   *
   * Nothing is polled yet unless the configuration says to: otherwise the first
   * client to read a flag is what starts that.
   */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    if (!this.enabled) {
      this.logger.info("Feature flags are disabled in the configuration");
      return;
    }

    onNet(FLAG_EVENTS.subscribe, () =>
      this.addSubscriber(globalThis.source)
    );
    onNet(FLAG_EVENTS.unsubscribe, () =>
      this.removeSubscriber(globalThis.source)
    );
    on("playerDropped", () => this.removeSubscriber(globalThis.source));

    this.restore();

    if (config.flags.polling.enabled) {
      // The loop's first turn fetches, which fills an empty cache too.
      this.startPolling();
      return;
    }

    // Nothing else starts the loop until a client subscribes, so a server with
    // nothing stored fetches once here rather than leaving the bag empty.
    if (!this.cache.isReady()) void this.load();
  }

  /**
   * Serves the last snapshot that was received, so reads work from the first
   * tick rather than from whenever the API answers.
   *
   * These values are marked stale until a fetch replaces them.
   */
  private restore(): void {
    const restored = this.store.read();

    if (!restored) return;

    const changes = this.cache.replace(restored.flags, true);
    const savedAt = restored.savedAt
      ? `, saved ${restored.savedAt.toISOString()}`
      : "";

    this.logger.info(
      `Serving ${restored.flags.length} cached feature flag(s) until the first fetch${savedAt}`
    );

    this.publish(changes);
  }

  /* --------------------------------- Polling ------------------------------- */

  /**
   * Starts the refresh loop, unless it is already running or nothing wants it.
   *
   * Guarded on the loop rather than on the pending timer: there is no timer
   * while a fetch is in flight, and a second client subscribing in that window
   * has to join the loop that is running rather than start one alongside it -
   * which would quietly double the rate for as long as both lasted.
   */
  private startPolling(): void {
    if (this.running || !this.polls) return;

    this.running = true;
    this.logger.info(
      `Polling feature flags every ${this.pollingIntervalMs}ms`
    );

    void this.loop();
  }

  /**
   * Stops polling at the loop's next turn. The values stay readable, and stay
   * in the state bag.
   */
  private stopPolling(): void {
    this.wake?.();
  }

  /**
   * Refreshes until nothing wants it any more.
   *
   * One loop and one request at a time, so a slow fetch delays the next turn
   * rather than overlapping it. The first turn fetches immediately, which is
   * what brings the flags up to date for whoever just subscribed - through the
   * cache window, so players arriving together cost one request between them.
   */
  private async loop(): Promise<void> {
    while (this.polls) {
      await this.load();

      if (!this.polls) break;

      await this.sleep(this.pollingIntervalMs);
    }

    this.running = false;
    this.logger.debug("Stopped polling feature flags");
  }

  /**
   * Waits out the interval, or until {@link stopPolling} cuts it short.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const finish = () => {
        clearTimeout(this.timer);

        this.timer = undefined;
        this.wake = undefined;

        resolve();
      };

      this.wake = finish;
      this.timer = setTimeout(finish, ms);
    });
  }

  /* -------------------------------- Fetching ------------------------------- */

  /**
   * Brings the held values up to date, if the cache window has passed.
   *
   * The one path to the API, whether a read asked or the polling loop did: a
   * poll that lands on a configuration a read has just fetched skips its turn
   * rather than spending a request to be told nothing changed.
   *
   * Failures are swallowed - a read falls back to the last known values rather
   * than throwing at whoever asked, and the loop tries again next time.
   */
  private async load(): Promise<void> {
    if (!this.enabled || this.fresh) return;

    try {
      this.apply(await this.client.flags.getConfig());
    } catch (error) {
      this.logger.warn(
        `Could not reach the flag API, serving the last known values: ${(error as Error).message}`
      );
    } finally {
      this.fetchedAt = Date.now();
    }
  }

  /**
   * Fetches the flag configuration and applies it immediately, ignoring both
   * the cache window and the polling schedule.
   * @returns The flags the server now holds, server-only ones included
   * @throws If the API request fails
   */
  async refresh(): Promise<FlagValues> {
    if (!this.enabled) {
      throw new Error("Feature flags are disabled in the configuration.");
    }

    try {
      this.apply(await this.client.flags.refresh());
    } finally {
      // Restarts the window like any other fetch, so the poll that follows an
      // explicit refresh does not immediately spend another request.
      this.fetchedAt = Date.now();
    }

    return this.cache.getValues();
  }

  /**
   * Takes a fetched payload as the current snapshot and announces what changed.
   */
  private apply(payload: FlagConfigPayload): void {
    const first = !this.cache.isReady();
    const wasStale = this.cache.isStale();
    const changes = this.cache.replace(payload.flags);

    this.warnOnAdvisedInterval(payload.pollIntervalSeconds);

    // Values confirmed as unchanged are already published and already stored.
    if (!first && !wasStale && !changes.length) return;

    this.store.write(payload.flags);

    this.logger.info(
      changes.length
        ? `Feature flags changed: ${changes.map((change) => change.key).join(", ")}`
        : `Loaded ${payload.flags.length} feature flag(s)`
    );

    this.publish(changes);
  }

  /**
   * Logs once when the configured interval polls faster than the API advises.
   */
  private warnOnAdvisedInterval(pollIntervalSeconds: number): void {
    const interval = this.pollingIntervalMs;

    if (this.advisedIntervalWarned || !this.polls) return;
    if (interval >= pollIntervalSeconds * 1000) return;

    this.advisedIntervalWarned = true;
    this.logger.warn(
      `Polling every ${interval}ms, faster than the ${pollIntervalSeconds}s the API advises`
    );
  }

  /* ------------------------------ Distribution ----------------------------- */

  /**
   * Publishes the held values: GlobalState for clients, and the local event
   * other resources listen on.
   */
  private publish(changes: FlagChange[]): void {
    if (!this.cache.isReady()) return;

    // GlobalState replicates to every client, so only shared values go in it.
    // Clients read it directly, which is why nothing about flags crosses the
    // network on their side.
    const shared = this.cache.getValues("shared");
    const encoded = JSON.stringify(shared);

    // Writing the bag is a broadcast to every player connected, so it happens
    // only when what players can see has actually changed - a server-only flag
    // being changed must not cost the whole server a replication.
    if (encoded !== this.published) {
      this.published = encoded;

      GlobalState.set(config.flags.global_state_key, shared, true);
    }

    if (!changes.length) return;

    // Server-side listeners are trusted and see the whole snapshot.
    emit(FLAG_EVENTS.updated, this.cache.getValues(), changes);
  }

  /* --------------------------------- Reads -------------------------------- */

  /**
   * Reads one flag whole - its key, type, value and runtime.
   * @param key - The flag's key
   * @param runtime - The runtime reading the flag, `server` by default
   */
  async getFlag(
    key: string,
    runtime?: FeatureFlagRuntime
  ): Promise<FlagConfigEntry | undefined> {
    await this.load();

    return this.cache.getEntry(key, runtime);
  }

  /**
   * Reads every flag this runtime may see, as a key/value object.
   * @param runtime - The runtime reading the flags, `server` by default. Pass
   * `shared` for exactly the set clients are given.
   */
  async getFlags(runtime?: FeatureFlagRuntime): Promise<FlagValues> {
    await this.load();

    return this.cache.getValues(runtime);
  }

  /**
   * Reads a flag's value, whatever its type.
   * @param key - The flag's key
   * @param fallback - Returned when the flag is missing or unreadable
   * @param runtime - The runtime reading the flag, `server` by default
   */
  async getFlagValue(
    key: string,
    fallback?: JsonValue,
    runtime?: FeatureFlagRuntime
  ): Promise<JsonValue | undefined> {
    await this.load();

    return this.cache.getValue(key, fallback, runtime);
  }

  /**
   * Checks whether a boolean flag is on.
   * @param key - The flag's key
   * @param fallback - Returned when the flag is not a readable boolean flag
   * @param runtime - The runtime reading the flag, `server` by default
   */
  async isEnabled(
    key: string,
    fallback = false,
    runtime?: FeatureFlagRuntime
  ): Promise<boolean> {
    await this.load();

    return this.cache.isEnabled(key, fallback, runtime);
  }

  /**
   * Reads the values held right now, without contacting the API.
   *
   * For callers that cannot wait on a read - what this returns is what the last
   * fetch or the stored cache left behind.
   *
   * @param runtime - The runtime reading the flags, `server` by default
   */
  getCachedFlags(runtime?: FeatureFlagRuntime): FlagValues {
    return this.cache.getValues(runtime);
  }
}
