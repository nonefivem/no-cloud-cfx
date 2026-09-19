import type {
  FeatureFlagRuntime,
  FeatureFlagType,
  FlagConfigEntry,
  JsonValue
} from "@nocloud/sdk";

/** Feature flag keys mapped to their current values. */
export type FlagValues = Record<string, JsonValue>;

/** How a flag differs from the snapshot that came before it. */
export type FlagChangeKind = "added" | "updated" | "removed";

/** One flag that differs between two snapshots. */
export interface FlagChange {
  key: string;
  kind: FlagChangeKind;
  type: FeatureFlagType;
  /** The flag's runtime as of the newer snapshot, or the older one if removed */
  runtime: FeatureFlagRuntime;
  /** Value before the change, absent when the flag was added */
  previous?: JsonValue;
  /** Value after the change, absent when the flag was removed */
  current?: JsonValue;
}

/**
 * Whether a runtime lets players' clients read the flag.
 *
 * Mirrors the SDK helper of the same name on purpose - importing it would pull
 * the whole SDK into the client bundle, which never talks to the API.
 * @param runtime - The flag's runtime
 */
export function isClientReadable(runtime: FeatureFlagRuntime): boolean {
  return runtime !== "server";
}

/**
 * Compares two snapshots, keyed by flag.
 * @param previous - The snapshot held before the refresh
 * @param next - The snapshot that just arrived
 * @returns The flags that were added, updated or removed
 */
export function diffFlags(
  previous: Map<string, FlagConfigEntry>,
  next: Map<string, FlagConfigEntry>
): FlagChange[] {
  const changes: FlagChange[] = [];

  for (const [key, entry] of next) {
    const before = previous.get(key);

    if (!before) {
      changes.push({
        key,
        kind: "added",
        type: entry.type,
        runtime: entry.runtime,
        current: entry.value
      });
      continue;
    }

    // A runtime flip matters as much as a value change - it decides whether
    // players still see the flag at all.
    if (
      before.runtime === entry.runtime &&
      before.type === entry.type &&
      JSON.stringify(before.value) === JSON.stringify(entry.value)
    ) {
      continue;
    }

    changes.push({
      key,
      kind: "updated",
      type: entry.type,
      runtime: entry.runtime,
      previous: before.value,
      current: entry.value
    });
  }

  for (const [key, entry] of previous) {
    if (next.has(key)) continue;

    changes.push({
      key,
      kind: "removed",
      type: entry.type,
      runtime: entry.runtime,
      previous: entry.value
    });
  }

  return changes;
}

/**
 * A snapshot of feature flags held in memory, with the readers used to get
 * values out of it.
 *
 * Reads are made on behalf of a runtime: the server sees every flag it was
 * served, a shared read sees only what may reach a player. A flag the runtime
 * may not read behaves exactly like one that does not exist.
 */
export class FlagCache {
  private entries: Map<string, FlagConfigEntry> = new Map();
  private ready = false;
  private stale = false;

  /**
   * @param defaultRuntime - The runtime reads are made on behalf of when the
   * caller does not state one. The server cache is constructed as `server`
   * because the server is the trusted side; the client cache as `shared`.
   */
  constructor(private readonly defaultRuntime: FeatureFlagRuntime) {}

  /** Whether a snapshot has been received yet. */
  isReady(): boolean {
    return this.ready;
  }

  /**
   * Whether the held values came from the last-known cache rather than from a
   * live snapshot.
   *
   * Stale values are the ones read on a restart before the first fetch answers,
   * and the ones a server keeps serving while the API is unreachable.
   */
  isStale(): boolean {
    return this.stale;
  }

  /**
   * Replaces the held snapshot.
   * @param entries - The flags in the new snapshot
   * @param stale - Whether these values came from the last-known cache
   * @returns How the new snapshot differs from the one it replaced
   */
  replace(entries: FlagConfigEntry[], stale = false): FlagChange[] {
    const next = new Map(entries.map((entry) => [entry.key, entry]));
    const changes = diffFlags(this.entries, next);

    this.entries = next;
    this.ready = true;
    this.stale = stale;

    return changes;
  }

  /** Whether a read made on behalf of `runtime` may see this flag. */
  private visible(entry: FlagConfigEntry, runtime: FeatureFlagRuntime) {
    return runtime === "server" || isClientReadable(entry.runtime);
  }

  /**
   * Reads one flag whole, treating a flag the runtime may not read as absent.
   * @param key - The flag's key
   * @param runtime - The runtime reading the flag
   */
  getEntry(
    key: string,
    runtime: FeatureFlagRuntime = this.defaultRuntime
  ): FlagConfigEntry | undefined {
    const entry = this.entries.get(key);

    return entry && this.visible(entry, runtime) ? entry : undefined;
  }

  /**
   * Reads every flag whole that this runtime may see.
   * @param runtime - The runtime reading the flags
   */
  getEntries(
    runtime: FeatureFlagRuntime = this.defaultRuntime
  ): FlagConfigEntry[] {
    return [...this.entries.values()].filter((entry) =>
      this.visible(entry, runtime)
    );
  }

  /**
   * Reads a flag's raw value, whatever its type.
   * @param key - The flag's key
   * @param fallback - Returned when the flag is missing or unreadable
   * @param runtime - The runtime reading the flag
   */
  getValue(
    key: string,
    fallback?: JsonValue,
    runtime: FeatureFlagRuntime = this.defaultRuntime
  ): JsonValue | undefined {
    const entry = this.getEntry(key, runtime);

    return entry ? entry.value : fallback;
  }

  /**
   * Reads the flags this runtime may see as a plain key/value object.
   * @param runtime - The runtime reading the flags
   */
  getValues(runtime: FeatureFlagRuntime = this.defaultRuntime): FlagValues {
    const values: FlagValues = {};

    for (const entry of this.getEntries(runtime)) {
      values[entry.key] = entry.value;
    }

    return values;
  }

  /**
   * Checks whether a boolean flag is on.
   *
   * A missing flag, one holding a non-boolean value, or one this runtime may
   * not read, reads as `fallback` - so archiving a flag in the dashboard can
   * never break a running server.
   *
   * @param key - The flag's key
   * @param fallback - Returned when the flag is not a readable boolean flag
   * @param runtime - The runtime reading the flag
   */
  isEnabled(
    key: string,
    fallback = false,
    runtime: FeatureFlagRuntime = this.defaultRuntime
  ): boolean {
    const entry = this.getEntry(key, runtime);

    return entry?.type === "boolean" && typeof entry.value === "boolean"
      ? entry.value
      : fallback;
  }
}

/**
 * The flag events.
 *
 * Values never travel as an event - clients read them out of GlobalState. The
 * two client events carry nothing at all; they only say whether somebody is
 * reading, which is what decides whether keeping the flags current is worth a
 * request.
 */
export const FLAG_EVENTS = {
  /**
   * Client -> server: this client is reading flags, keep them current.
   *
   * The server cannot see a client read replicated state, so a server whose
   * only flag readers are clients would otherwise never learn that anyone
   * wants the values kept fresh.
   */
  subscribe: "nocloud.flags.subscribe",
  /**
   * Client -> server: this client has stopped reading flags.
   *
   * Sent when a client has not read one for a while, so that a player who
   * happened to read a flag once is not treated as a reader for their whole
   * session.
   */
  unsubscribe: "nocloud.flags.unsubscribe",
  /**
   * Local, server side: a value changed, with `(values, changes)`.
   */
  updated: "nocloud.flags.updated"
} as const;
