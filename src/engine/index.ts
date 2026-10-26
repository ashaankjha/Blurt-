/**
 * Engine public API: a pure reducer plus read-only helpers. No React or Expo imports.
 * See HANDOFF.md in this folder for usage.
 */
import { currentPlayer } from './rules';
import type { GameState } from './types';

export * from './types';
export { createGame, reduce, rollFuseDurationMs } from './rules';
export { mulberry32 } from './rng';

/**
 * Fuse progress in [0, 1] (0 = just lit, 1 = blown). 0 when not playing; frozen while paused.
 * Drives tick tempo and, in chill mode only, a visible fuse.
 */
export function fuseProgress(state: GameState, now: number): number {
  const duration = state.fuseDurationMs;
  switch (state.phase) {
    case 'playing': {
      if (state.fuseEndsAt === null || !duration) return 0;
      const elapsed = duration - (state.fuseEndsAt - now);
      return clamp01(elapsed / duration);
    }
    case 'paused':
      if (state.pausedRemainingMs === null || !duration) return 0;
      return clamp01(1 - state.pausedRemainingMs / duration);
    case 'caught':
      return 1;
    default:
      return 0;
  }
}

/** Ms until the fuse blows, or null when no fuse is burning. Only show in UI when settings.showFuse. */
export function fuseRemainingMs(state: GameState, now: number): number | null {
  if (state.phase === 'playing' && state.fuseEndsAt !== null) return Math.max(0, state.fuseEndsAt - now);
  if (state.phase === 'paused') return state.pausedRemainingMs;
  return null;
}

/** Display name for whoever holds the phone: the player's name if entered, else the team name. */
export function holderLabel(state: GameState): string {
  const team = state.settings.teams[state.holderTeamIndex];
  if (team === undefined) return '';
  return currentPlayer(state, team) ?? team.name;
}

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
