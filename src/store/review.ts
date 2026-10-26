/**
 * In-app review prompt (PRD section 11): StoreKit / Play In-App Review, shown only from the Win
 * screen and at most once per 3 completed games. Never on web, never throws.
 *
 * - The game store calls `recordCompletedGame()` once per game, the first time it reaches `won`
 *   (an undo and a second win in the same game does not count twice).
 * - The Win screen calls `maybeRequestReview()`. It asks the OS for the review sheet when at least
 *   3 games were completed since the last request (so on games 3, 6, 9, ...), and only records the
 *   request when the platform says a review flow is available. The OS may still decide not to show
 *   the sheet (Apple caps it at 3 times a year).
 *
 * Counters persist in kv (`KV_KEYS.review`), separate from settings, so "Reset all settings" does
 * not re-arm the prompt.
 */
import { Platform } from 'react-native';

import { kv as defaultKV, KV_KEYS, type KV } from '../content/kv';

/** The Win screen waits this long, so the confetti lands before the OS review sheet (if due). */
export const REVIEW_PROMPT_DELAY_MS = 2500;

/** Completed games between two review requests. */
export const REVIEW_EVERY_N_GAMES = 3;

export interface StoreReviewApi {
  isAvailableAsync(): Promise<boolean>;
  requestReview(): Promise<void>;
}

export interface ReviewState {
  /** Games that reached a win, ever. */
  completedGames: number;
  /** `completedGames` when the review was last requested, or null if never. */
  lastPromptAt: number | null;
}

export interface ReviewPrompt {
  getState(): ReviewState;
  recordCompletedGame(): void;
  /** Whether the next `maybeRequestReview()` would ask (ignoring platform availability). */
  isDue(): boolean;
  /** Resolves true when the review sheet was requested. Never rejects. */
  maybeRequestReview(): Promise<boolean>;
}

export interface ReviewPromptDeps {
  kv: KV;
  /** Platform.OS. The prompt never runs on 'web'. */
  platform: string;
  /** Loads expo-store-review lazily, so a build without the native module never crashes. */
  loadStoreReview: () => StoreReviewApi;
  every: number;
}

const EMPTY: ReviewState = { completedGames: 0, lastPromptAt: null };

function parse(raw: string | null): ReviewState {
  if (!raw) return { ...EMPTY };
  try {
    const v = JSON.parse(raw) as Partial<ReviewState>;
    const completedGames =
      typeof v.completedGames === 'number' && Number.isFinite(v.completedGames) && v.completedGames >= 0
        ? Math.floor(v.completedGames)
        : 0;
    const lastPromptAt =
      typeof v.lastPromptAt === 'number' && Number.isFinite(v.lastPromptAt) && v.lastPromptAt >= 0
        ? Math.min(Math.floor(v.lastPromptAt), completedGames)
        : null;
    return { completedGames, lastPromptAt };
  } catch {
    return { ...EMPTY };
  }
}

function loadExpoStoreReview(): StoreReviewApi {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: requireNativeModule throws if missing
  return require('expo-store-review') as StoreReviewApi;
}

export function createReviewPrompt(overrides: Partial<ReviewPromptDeps> = {}): ReviewPrompt {
  const deps: ReviewPromptDeps = {
    kv: defaultKV,
    platform: Platform.OS,
    loadStoreReview: loadExpoStoreReview,
    every: REVIEW_EVERY_N_GAMES,
    ...overrides,
  };
  let inFlight = false;

  const read = () => parse(deps.kv.get(KV_KEYS.review));
  const write = (s: ReviewState) => deps.kv.set(KV_KEYS.review, JSON.stringify(s));
  const due = (s: ReviewState) =>
    s.completedGames >= deps.every && (s.lastPromptAt === null || s.completedGames - s.lastPromptAt >= deps.every);

  return {
    getState: read,
    recordCompletedGame() {
      try {
        const s = read();
        write({ ...s, completedGames: s.completedGames + 1 });
      } catch {
        // Never break the win screen over a counter.
      }
    },
    isDue: () => due(read()),
    async maybeRequestReview() {
      if (deps.platform === 'web' || inFlight) return false;
      inFlight = true;
      try {
        const s = read();
        if (!due(s)) return false;
        const storeReview = deps.loadStoreReview();
        if (!(await storeReview.isAvailableAsync())) return false;
        write({ ...s, lastPromptAt: s.completedGames });
        await storeReview.requestReview();
        return true;
      } catch {
        return false;
      } finally {
        inFlight = false;
      }
    },
  };
}

/** The app's review prompt. */
export const reviewPrompt: ReviewPrompt = createReviewPrompt();
