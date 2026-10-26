/**
 * Single source of truth for app identity and gameplay defaults.
 * Renaming the app (see PRD section 1 backups) is a one-line change to APP_NAME.
 */

export const APP_NAME = 'Blurt!';
/** Store/slug-safe variant of the name, used by app.config.ts. */
export const APP_SLUG = 'blurt';
export const APP_BUNDLE_ID = 'com.ashaankjha.blurt';
export const APP_VERSION = '1.0.0';

export const DEFAULTS = {
  teamCount: 2,
  targetScore: 7,
  /** null = unlimited */
  skipsPerTurn: 3 as number | null,
  fuseMinMs: 45_000,
  fuseMaxMs: 75_000,
  showFuse: false,
} as const;

export const LIMITS = {
  minTeams: 2,
  maxTeams: 4,
  minTargetScore: 1,
  maxTargetScore: 30,
  /** Allowed choices for skips per turn; null = unlimited. */
  skipChoices: [0, 1, 3, null] as (number | null)[],
  /** Bounds for the fuse range slider. */
  fuseFloorMs: 15_000,
  fuseCeilMs: 180_000,
  /** Got it / Skip debounce. A second advance inside this window is ignored. */
  advanceDebounceMs: 300,
} as const;

/** Phrase rules (PRD section 4). Shared by content scripts and custom-pack validation. */
export const PHRASE_RULES = {
  maxWords: 5,
  maxChars: 32,
} as const;

/** Pack id of the virtual "Everything Mix" pack (union of all family packs, built at runtime). */
export const EVERYTHING_MIX_ID = 'everything-mix';

/** Whether After Dark (18+) packs are compiled into the binary at all. See PRD open questions. */
export const SHIP_AFTER_DARK = true;
