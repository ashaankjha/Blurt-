/**
 * SettingsStore contract (PRD section 7). FROZEN after Phase 0.
 * Implementation (Agent B) lives in src/store/settings.ts and persists via expo-sqlite/kv-store.
 */
import type { Mode } from '../engine/types';

export interface DefaultRules {
  targetScore: number;
  /** null = unlimited */
  skipsPerTurn: number | null;
  fuseMinMs: number;
  fuseMaxMs: number;
  showFuse: boolean;
  mode: Mode;
}

export interface Settings {
  soundEnabled: boolean;
  /** 0..1 */
  volume: number;
  hapticsEnabled: boolean;
  /** Buzzer id from AudioService.listBuzzers(), or 'random'. */
  buzzerId: string | 'random';
  /** When true, the iOS silent switch mutes the game. Default false (party game: play through it). */
  respectSilentMode: boolean;
  /** 18+ "After Dark" packs visible in the pack picker. Never included in Quick Play. */
  afterDarkEnabled: boolean;
  /** First-launch tutorial already shown. */
  hasSeenTutorial: boolean;
  defaultRules: DefaultRules;
  /** Last used pack selection for Custom Game. Empty = none yet. */
  lastPackIds: string[];
}

export interface SettingsActions {
  set<K extends keyof Settings>(key: K, value: Settings[K]): void;
  setDefaultRules(patch: Partial<DefaultRules>): void;
  /** Restore every setting to its default (does not touch phrase history). */
  resetAll(): void;
}

export type SettingsStore = Settings & SettingsActions;
