import type { FlagConfigEntry } from "@nocloud/sdk";
import { Logger } from "@common";

/**
 * Bumped when the stored shape changes, so an entry written by an older
 * release is discarded rather than trusted.
 */
const CACHE_VERSION = 1;

const FLAG_TYPES = ["boolean", "string", "number", "json"];
const FLAG_RUNTIMES = ["server", "shared"];

interface PersistedSnapshot {
  version: number;
  savedAt: string;
  flags: FlagConfigEntry[];
}

/** A snapshot read back from storage. */
export interface RestoredSnapshot {
  flags: FlagConfigEntry[];
  /** When it was written, or undefined if the entry predates that field. */
  savedAt?: Date;
}

/**
 * Whether a value read back from storage is a flag entry.
 *
 * Storage outlives the code that wrote it, so everything read back is checked
 * rather than cast - a half-written or hand-edited entry must be discarded, not
 * served as configuration.
 */
function isFlagEntry(value: unknown): value is FlagConfigEntry {
  if (typeof value !== "object" || value === null) return false;

  const entry = value as Partial<FlagConfigEntry>;

  return (
    typeof entry.key === "string" &&
    typeof entry.type === "string" &&
    FLAG_TYPES.includes(entry.type) &&
    typeof entry.runtime === "string" &&
    FLAG_RUNTIMES.includes(entry.runtime) &&
    "value" in entry
  );
}

/**
 * The last flag snapshot the server received, kept in resource key/value
 * storage.
 *
 * It is what makes a restart instant and an outage survivable: the values are
 * there to serve before the first fetch answers, and they stay there when it
 * never does. Storage is per resource and stays on the server host, so nothing
 * else reads it.
 */
export class FlagStore {
  private readonly logger = new Logger("FlagStore");
  private warnedUnavailable = false;

  /**
   * @param key - The storage key the snapshot is held under
   * @param enabled - Whether the snapshot is persisted at all
   */
  constructor(
    private readonly key: string,
    private readonly enabled: boolean
  ) {}

  /**
   * Whether the KVP natives this uses exist on this build.
   *
   * Server-side key/value storage is newer than the client natives, so an
   * older build is left without a cache rather than erroring on every read.
   */
  private get available(): boolean {
    if (!this.enabled) return false;

    if (
      typeof GetResourceKvpString !== "function" ||
      typeof SetResourceKvp !== "function"
    ) {
      // Said once: this is asked on every read and every write.
      if (!this.warnedUnavailable) {
        this.warnedUnavailable = true;
        this.logger.warn(
          "Key/value storage is unavailable on this build, flags will not be cached"
        );
      }

      return false;
    }

    return true;
  }

  /**
   * Reads back the last snapshot that was written.
   * @returns The snapshot, or undefined when there is none, it cannot be read,
   * or it was written in a shape this release no longer understands
   */
  read(): RestoredSnapshot | undefined {
    if (!this.available) return undefined;

    try {
      const raw = GetResourceKvpString(this.key);

      if (!raw) return undefined;

      const parsed = JSON.parse(raw) as Partial<PersistedSnapshot>;

      if (parsed.version !== CACHE_VERSION) {
        this.logger.debug(
          `Discarding a cached snapshot written by version ${parsed.version}`
        );
        this.clear();
        return undefined;
      }

      if (!Array.isArray(parsed.flags) || !parsed.flags.every(isFlagEntry)) {
        this.logger.warn("Discarding a malformed cached snapshot");
        this.clear();
        return undefined;
      }

      const savedAt = parsed.savedAt ? new Date(parsed.savedAt) : undefined;

      return {
        flags: parsed.flags,
        savedAt: savedAt && !isNaN(savedAt.getTime()) ? savedAt : undefined
      };
    } catch (error) {
      this.logger.warn(
        `Could not read the cached flags: ${(error as Error).message}`
      );
      return undefined;
    }
  }

  /**
   * Writes a snapshot, replacing whatever was held before it.
   *
   * Failing to write is never fatal - the values are already in memory, and the
   * cache only matters to the next start.
   *
   * @param flags - The flags to keep
   */
  write(flags: FlagConfigEntry[]): void {
    if (!this.available) return;

    const snapshot: PersistedSnapshot = {
      version: CACHE_VERSION,
      savedAt: new Date().toISOString(),
      flags
    };

    try {
      SetResourceKvp(this.key, JSON.stringify(snapshot));
    } catch (error) {
      this.logger.warn(
        `Could not cache the flags: ${(error as Error).message}`
      );
    }
  }

  /**
   * Discards the stored snapshot.
   */
  clear(): void {
    if (typeof DeleteResourceKvp !== "function") return;

    try {
      DeleteResourceKvp(this.key);
    } catch (error) {
      this.logger.debug(
        `Could not clear the cached flags: ${(error as Error).message}`
      );
    }
  }
}
