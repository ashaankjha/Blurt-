/**
 * Tiny synchronous key-value store used by the content runtime and the settings store.
 *
 * The app uses `expo-sqlite/kv-store` (SQLite-backed, sync API). Tests inject `createMemoryKV()`;
 * `src/content/jest.setup.ts` also mocks `expo-sqlite/kv-store` globally so code that uses the
 * default `kv` works under Jest without native modules.
 */
import { Storage } from 'expo-sqlite/kv-store';

export interface KV {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  keys(): string[];
}

/** In-memory KV for tests and fallbacks. `snapshot()` exposes the raw contents. */
export interface MemoryKV extends KV {
  snapshot(): Record<string, string>;
  clear(): void;
}

export function createMemoryKV(initial: Record<string, string> = {}): MemoryKV {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    get: (key) => map.get(key) ?? null,
    set: (key, value) => {
      map.set(key, value);
    },
    remove: (key) => {
      map.delete(key);
    },
    keys: () => [...map.keys()],
    snapshot: () => Object.fromEntries(map),
    clear: () => map.clear(),
  };
}

function warn(op: string, key: string, error: unknown) {
  if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn(`[kv] ${op}(${key}) failed`, error);
}

/**
 * KV over expo-sqlite/kv-store. Failures are swallowed (and logged in dev): losing a write must
 * never crash a party game mid-round.
 */
export function createSqliteKV(
  storage: Pick<typeof Storage, 'getItemSync' | 'setItemSync' | 'removeItemSync' | 'getAllKeysSync'> = Storage,
): KV {
  return {
    get(key) {
      try {
        return storage.getItemSync(key);
      } catch (e) {
        warn('get', key, e);
        return null;
      }
    },
    set(key, value) {
      try {
        storage.setItemSync(key, value);
      } catch (e) {
        warn('set', key, e);
      }
    },
    remove(key) {
      try {
        storage.removeItemSync(key);
      } catch (e) {
        warn('remove', key, e);
      }
    },
    keys() {
      try {
        return storage.getAllKeysSync();
      } catch (e) {
        warn('keys', '*', e);
        return [];
      }
    },
  };
}

/** App-wide default store. */
export const kv: KV = createSqliteKV();

/** All persisted keys are namespaced so they never collide with other kv-store users. */
export const KV_KEYS = {
  settings: 'blurt.settings',
  seenPrefix: 'blurt.seen.v1.',
  customPacks: 'blurt.custom.v1',
  mixCount: 'blurt.mixcount.v1',
} as const;
