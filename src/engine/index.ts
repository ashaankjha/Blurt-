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

/**
 * Sudden death: two or more teams share the top score at or above the target, so nobody has won
 * yet and play goes on until one team leads alone (only possible with 3-4 teams, where every
 * team but the caught one scores). Returns the tied teams and their score, or null.
 */
export function suddenDeath(state: GameState): { teamIds: string[]; score: number } | null {
  if (state.phase === 'won') return null;
  const { teams, targetScore } = state.settings;
  if (teams.length === 0) return null;
  const score = Math.max(...teams.map((t) => state.scores[t.id] ?? 0));
  if (score < targetScore) return null;
  const teamIds = teams.filter((t) => (state.scores[t.id] ?? 0) === score).map((t) => t.id);
  return teamIds.length > 1 ? { teamIds, score } : null;
}

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
