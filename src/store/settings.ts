/**
 * Settings store (PRD F9). Zustand + `persist` over the sync kv wrapper (expo-sqlite/kv-store),
 * so hydration is synchronous: the first render already sees persisted values.
 * Persisted data is sanitized and merged over DEFAULT_SETTINGS, so new keys get their defaults
 * and corrupt values fall back instead of crashing.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEFAULTS } from '../config';
import { kv as defaultKV, KV_KEYS, type KV } from '../content/kv';
import type { Mode } from '../engine/types';
import type { DefaultRules, Settings, SettingsStore } from './settingsTypes';

export * from './settingsTypes';

export const SETTINGS_STORAGE_KEY = KV_KEYS.settings;
/** Bump when the persisted shape changes incompatibly; add a step to `migrate`. */
export const SETTINGS_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  soundEnabled: true,
  volume: 1,
  hapticsEnabled: true,
  buzzerId: 'random',
  respectSilentMode: false,
  afterDarkEnabled: false,
  hasSeenTutorial: false,
  defaultRules: {
    targetScore: DEFAULTS.targetScore,
    skipsPerTurn: DEFAULTS.skipsPerTurn,
    fuseMinMs: DEFAULTS.fuseMinMs,
    fuseMaxMs: DEFAULTS.fuseMaxMs,
    showFuse: DEFAULTS.showFuse,
    mode: 'classic',
  },
  lastPackIds: [],
};

const MODES: readonly Mode[] = ['classic', 'taboo', 'charades', 'one-word'];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

function pick<T>(raw: Obj, key: string, ok: (v: unknown) => boolean, fallback: T): T {
  return ok(raw[key]) ? (raw[key] as T) : fallback;
}

function sanitizeRules(raw: unknown, base: DefaultRules): DefaultRules {
  if (!isObj(raw)) return { ...base };
  return {
    targetScore: pick(raw, 'targetScore', isNum, base.targetScore),
    skipsPerTurn: pick(raw, 'skipsPerTurn', (v) => v === null || isNum(v), base.skipsPerTurn),
    fuseMinMs: pick(raw, 'fuseMinMs', isNum, base.fuseMinMs),
    fuseMaxMs: pick(raw, 'fuseMaxMs', isNum, base.fuseMaxMs),
    showFuse: pick(raw, 'showFuse', isBool, base.showFuse),
    mode: pick(raw, 'mode', (v) => MODES.includes(v as Mode), base.mode),
  };
}

/** Merges untrusted persisted data over `base`, keeping only well-typed known keys. */
export function sanitizeSettings(raw: unknown, base: Settings = DEFAULT_SETTINGS): Settings {
  if (!isObj(raw)) return { ...base, defaultRules: { ...base.defaultRules } };
  return {
    soundEnabled: pick(raw, 'soundEnabled', isBool, base.soundEnabled),
    volume: isNum(raw.volume) ? Math.min(1, Math.max(0, raw.volume)) : base.volume,
    hapticsEnabled: pick(raw, 'hapticsEnabled', isBool, base.hapticsEnabled),
    buzzerId: pick(raw, 'buzzerId', isStr, base.buzzerId),
    respectSilentMode: pick(raw, 'respectSilentMode', isBool, base.respectSilentMode),
    afterDarkEnabled: pick(raw, 'afterDarkEnabled', isBool, base.afterDarkEnabled),
    hasSeenTutorial: pick(raw, 'hasSeenTutorial', isBool, base.hasSeenTutorial),
    defaultRules: sanitizeRules(raw.defaultRules, base.defaultRules),
    lastPackIds: Array.isArray(raw.lastPackIds) ? raw.lastPackIds.filter(isStr) : [...base.lastPackIds],
  };
}

const settingsOf = (s: SettingsStore): Settings => sanitizeSettings(s);

/** Builds a persisted settings store over `kv`. The app uses `useSettings`; tests inject a kv. */
export function createSettingsStore(kv: KV = defaultKV) {
  return create<SettingsStore>()(
    persist(
      (set) => ({
        ...DEFAULT_SETTINGS,
        defaultRules: { ...DEFAULT_SETTINGS.defaultRules },
        set: (key, value) => set({ [key]: value } as Partial<Settings>),
        setDefaultRules: (patch) => set((s) => ({ defaultRules: { ...s.defaultRules, ...patch } })),
        resetAll: () => set({ ...DEFAULT_SETTINGS, defaultRules: { ...DEFAULT_SETTINGS.defaultRules } }),
      }),
      {
        name: SETTINGS_STORAGE_KEY,
        version: SETTINGS_VERSION,
        storage: createJSONStorage<Settings>(() => ({
          getItem: (name) => kv.get(name),
          setItem: (name, value) => kv.set(name, value),
          removeItem: (name) => kv.remove(name),
        })),
        partialize: settingsOf,
        // v1 is the first persisted shape; sanitizeSettings in `merge` handles additive changes.
        migrate: (persisted) => persisted as Settings,
        merge: (persisted, current) => ({ ...current, ...sanitizeSettings(persisted, current) }),
      },
    ),
  );
}

export const useSettings = createSettingsStore();
