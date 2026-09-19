import { config, FLAG_EVENTS, FlagValues, Logger } from "@common";
import type { JsonValue } from "@nocloud/sdk";

/**
 * How long a client keeps being counted as a reader after its last read.
 *
 * A player who checks one flag on spawn should not hold the server to polling
 * for the rest of their session, and a menu that reads every frame should not
 * have to say so more than once.
 */
const IDLE_TIMEOUT_MS = 300_000;

/**
 * The client's view of the feature flags.
 *
 * Clients never talk to the API and never ask the server for anything: the
 * server publishes the shared flags to GlobalState, the game replicates it, and
 * this reads them back out of the local copy. Reads cost no network and no
 * round trip, which is what lets them stay synchronous - the shape client code
 * actually wants inside a tick.
 *
 * The only thing that ever leaves a client is a pair of signals, not values: a
 * read while unsubscribed says "this client reads flags", and five minutes
 * without one says it no longer does. That is what tells the server whether
 * keeping the flags current is worth a request - it cannot see a client read
 * replicated state, so it has to be told.
 *
 * Only `shared` flags are published, so a server-only value is not merely
 * hidden here - it never arrives.
 */
export class ClientFlagsManager {
  private readonly logger = new Logger("ClientFlagsManager");

  private subscribed = false;
  private lastReadAt = 0;
  private idleTimer?: ReturnType<typeof setTimeout>;

  /**
   * The replicated values, or an empty set before the server has published any.
   */
  private get values(): FlagValues {
    const values = GlobalState[config.flags.global_state_key];

    return typeof values === "object" && values !== null ? values : {};
  }

  /**
   * Reads the replicated values, subscribing if this client is not already
   * counted as a reader.
   *
   * A read while subscribed costs a timestamp and the state bag lookup, so
   * reading in a tick is fine.
   */
  private read(): FlagValues {
    if (config.flags.enabled) this.touch();

    return this.values;
  }

  /**
   * Marks this client as reading, subscribing if it was not already.
   */
  private touch(): void {
    this.lastReadAt = GetGameTimer();

    if (this.subscribed) return;

    this.subscribed = true;

    this.logger.debug("Subscribing to feature flag updates");
    emitNet(FLAG_EVENTS.subscribe);

    this.watchIdle();
  }

  /**
   * Waits out the idle window, unsubscribing if nothing read in the meantime.
   *
   * Rearmed for whatever is left of the window rather than checking on a tick,
   * so a client that reads constantly costs one timer, not one per read.
   */
  private watchIdle(): void {
    const elapsed = GetGameTimer() - this.lastReadAt;

    this.idleTimer = setTimeout(
      () => {
        this.idleTimer = undefined;

        if (!this.subscribed) return;

        if (GetGameTimer() - this.lastReadAt < IDLE_TIMEOUT_MS) {
          this.watchIdle();
          return;
        }

        this.unsubscribe();
      },
      Math.max(IDLE_TIMEOUT_MS - elapsed, 0)
    );
  }

  /**
   * Tells the server this client has stopped reading flags.
   *
   * The next read subscribes again - the values in the state bag stay readable
   * either way, they simply stop being refreshed on this client's account.
   */
  private unsubscribe(): void {
    this.subscribed = false;

    this.logger.debug("No longer reading feature flags, unsubscribing");
    emitNet(FLAG_EVENTS.unsubscribe);
  }

  /** Whether the server has published any values yet. */
  get ready(): boolean {
    return GlobalState[config.flags.global_state_key] != null;
  }

  /**
   * Calls back whenever the server publishes different values.
   *
   * Watching is not reading: it does not subscribe this client, and the server
   * only publishes what a fetch found. So a change reaches a watcher when
   * something is keeping the flags current - a read on this client, or
   * `polling.enabled` on the server.
   *
   * @param listener - Called with every flag this client holds
   */
  watch(listener: (values: FlagValues) => void): void {
    AddStateBagChangeHandler(
      config.flags.global_state_key,
      "global",
      (_bag: string, _key: string, values: unknown) =>
        listener(
          typeof values === "object" && values !== null
            ? (values as FlagValues)
            : {}
        )
    );
  }

  /**
   * Logs how flags stand for this client. There is nothing to set up - reading
   * the replicated state is the whole mechanism.
   */
  init(): void {
    if (!config.flags.enabled) {
      this.logger.info("Feature flags are disabled in the configuration");
      return;
    }

    this.logger.debug(
      this.ready
        ? "Feature flags are available"
        : "Waiting for the server to publish the feature flags"
    );
  }

  /**
   * Reads every flag this client holds, as a key/value object.
   */
  getFlags(): FlagValues {
    return this.read();
  }

  /**
   * Reads a flag's value, whatever its type.
   * @param key - The flag's key
   * @param fallback - Returned when the flag is missing, or before the server
   * has published any
   */
  getFlagValue(key: string, fallback?: JsonValue): JsonValue | undefined {
    const value = this.read()[key];

    return value === undefined ? fallback : value;
  }

  /**
   * Checks whether a boolean flag is on.
   *
   * A missing flag, one holding a non-boolean value, or one the server does not
   * share with clients, reads as `fallback`.
   *
   * @param key - The flag's key
   * @param fallback - Returned when the flag is not a readable boolean flag
   */
  isEnabled(key: string, fallback = false): boolean {
    const value = this.read()[key];

    return typeof value === "boolean" ? value : fallback;
  }
}
