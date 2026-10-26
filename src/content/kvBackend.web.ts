/**
 * Web backing store for `kv`: localStorage. expo-sqlite's web build needs a WASM worker and
 * cross-origin isolation headers; web is only a dev/E2E target, so localStorage is enough.
 */
import type { SyncStorage } from './kvBackend';

const ls = (): Storage | null => (typeof localStorage === 'undefined' ? null : localStorage);

export const defaultStorage: SyncStorage = {
  getItemSync: (key: string) => ls()?.getItem(key) ?? null,
  setItemSync: (key: string, value: unknown) => {
    if (typeof value !== 'string') throw new Error('kvBackend.web only stores strings');
    ls()?.setItem(key, value);
  },
  removeItemSync: (key: string) => {
    const store = ls();
    if (!store || store.getItem(key) === null) return false;
    store.removeItem(key);
    return true;
  },
  getAllKeysSync: () => {
    const store = ls();
    return store
      ? Array.from({ length: store.length }, (_, i) => store.key(i)).filter((k): k is string => k !== null)
      : [];
  },
} as SyncStorage;
