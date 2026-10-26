/**
 * Engine public API. Phase 0 STUB: Agent A replaces the bodies, keeping these signatures.
 */
import type { Action, CreateGame, EngineDeps, GameSettings, GameState, Reduce } from './types';

export * from './types';

export const createGame: CreateGame = (settings: GameSettings): GameState => ({
  settings,
  phase: 'setup',
  scores: Object.fromEntries(settings.teams.map((t) => [t.id, 0])),
  holderTeamIndex: 0,
  currentPhrase: null,
  fuseEndsAt: null,
  skipsLeft: settings.skipsPerTurn,
  roundLog: [],
  fuseDurationMs: null,
  pausedRemainingMs: null,
  lastAdvanceAt: null,
  playerCursor: Object.fromEntries(settings.teams.map((t) => [t.id, 0])),
  round: 0,
  winnerTeamId: null,
  stats: { gotIt: {}, skips: {}, fastest: null },
  phraseShownAt: null,
});

export const reduce: Reduce = (state: GameState, _action: Action, _deps: EngineDeps): GameState => state;

/**
 * Fuse progress in [0, 1] (0 = just lit, 1 = blown). 0 when not playing; frozen while paused.
 * Drives tick tempo and, in chill mode only, a visible fuse.
 */
export function fuseProgress(state: GameState, now: number): number {
  void state;
  void now;
  return 0;
}

/** Ms until the fuse blows, or null when no fuse is burning. Only show in UI when settings.showFuse. */
export function fuseRemainingMs(state: GameState, now: number): number | null {
  void state;
  void now;
  return null;
}

/** Display name for whoever holds the phone: the player's name if entered, else the team name. */
export function holderLabel(state: GameState): string {
  return state.settings.teams[state.holderTeamIndex]?.name ?? '';
}
