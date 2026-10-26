/**
 * Settings store. Phase 0 STUB (in-memory, not persisted): Agent B adds kv-store persistence,
 * keeping the exported names.
 */
import { create } from 'zustand';

import { DEFAULTS } from '../config';
import type { Settings, SettingsStore } from './settingsTypes';

export * from './settingsTypes';

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

export const useSettings = create<SettingsStore>()((set) => ({
  ...DEFAULT_SETTINGS,
  set: (key, value) => set({ [key]: value } as Partial<Settings>),
  setDefaultRules: (patch) => set((s) => ({ defaultRules: { ...s.defaultRules, ...patch } })),
  resetAll: () => set({ ...DEFAULT_SETTINGS }),
}));
