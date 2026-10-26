/**
 * The game reducer: a pure, immutable, deterministic state machine (PRD sections 2 and 7).
 * Time, randomness and phrase drawing are injected through EngineDeps.
 * Any action that is invalid for the current phase returns the input state object unchanged.
 */
import { LIMITS } from '../config';
import type { Action, EngineDeps, GameSettings, GameState, Team } from './types';

export function createGame(settings: GameSettings): GameState {
  return {
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
  };
}

/**
 * Random fuse length in whole ms, uniform over [fuseMinMs, fuseMaxMs] inclusive.
 * A reversed range is tolerated (bounds are swapped).
 */
export function rollFuseDurationMs(settings: GameSettings, rng: () => number): number {
  const lo = Math.min(settings.fuseMinMs, settings.fuseMaxMs);
  const hi = Math.max(settings.fuseMinMs, settings.fuseMaxMs);
  const r = Math.min(Math.max(rng(), 0), 1);
  return Math.min(hi, Math.max(lo, Math.round(lo + r * (hi - lo))));
}

const holderTeam = (state: GameState): Team => state.settings.teams[state.holderTeamIndex];

/** Name of the player of `team` the cursor points at, or undefined when the team has no names. */
export function currentPlayer(state: GameState, team: Team): string | undefined {
  if (team.players.length === 0) return undefined;
  const cursor = state.playerCursor[team.id] ?? 0;
  return team.players[cursor % team.players.length];
}

const bump = (rec: Record<string, number>, key: string, by = 1): Record<string, number> => ({
  ...rec,
  [key]: (rec[key] ?? 0) + by,
});

const nextTeamIndex = (state: GameState): number => (state.holderTeamIndex + 1) % state.settings.teams.length;

function startRound(state: GameState, deps: EngineDeps): GameState {
  const now = deps.now();
  const duration = rollFuseDurationMs(state.settings, deps.rng);
  return {
    ...state,
    phase: 'playing',
    round: state.round + 1,
    fuseDurationMs: duration,
    fuseEndsAt: now + duration,
    pausedRemainingMs: null,
    currentPhrase: deps.draw(),
    phraseShownAt: now,
    skipsLeft: state.settings.skipsPerTurn,
    lastAdvanceAt: null,
  };
}

/** Fuse check at `now`: blows it (phase 'caught', points scored) or returns the same state. */
function tick(state: GameState, now: number): GameState {
  if (state.phase !== 'playing' || state.fuseEndsAt === null || now < state.fuseEndsAt) return state;
  const team = holderTeam(state);
  const scores = { ...state.scores };
  for (const t of state.settings.teams) {
    if (t.id !== team.id) scores[t.id] = (scores[t.id] ?? 0) + 1;
  }
  const caughtPlayer = currentPlayer(state, team);
  return {
    ...state,
    phase: 'caught',
    scores,
    roundLog: [
      ...state.roundLog,
      caughtPlayer === undefined
        ? { caughtTeamId: team.id, at: now }
        : { caughtTeamId: team.id, at: now, caughtPlayer },
    ],
    fuseEndsAt: null,
    fuseDurationMs: null,
    pausedRemainingMs: null,
    phraseShownAt: null,
  };
}

const debounced = (state: GameState, now: number): boolean =>
  state.lastAdvanceAt !== null && now - state.lastAdvanceAt < LIMITS.advanceDebounceMs;

const fuseBlown = (state: GameState, now: number): boolean => state.fuseEndsAt !== null && now >= state.fuseEndsAt;

function gotIt(state: GameState, deps: EngineDeps): GameState {
  const now = deps.now();
  if (debounced(state, now)) return state;
  if (fuseBlown(state, now)) return tick(state, now);

  const team = holderTeam(state);
  const player = currentPlayer(state, team);
  let fastest = state.stats.fastest;
  if (state.phraseShownAt !== null) {
    const ms = now - state.phraseShownAt;
    if (fastest === null || ms < fastest.ms) {
      fastest = player === undefined ? { teamId: team.id, ms } : { teamId: team.id, ms, player };
    }
  }
  return {
    ...state,
    holderTeamIndex: nextTeamIndex(state),
    playerCursor: bump(state.playerCursor, team.id),
    currentPhrase: deps.draw(),
    phraseShownAt: now,
    skipsLeft: state.settings.skipsPerTurn,
    lastAdvanceAt: now,
    stats: { ...state.stats, gotIt: bump(state.stats.gotIt, team.id), fastest },
  };
}

function skip(state: GameState, deps: EngineDeps): GameState {
  const now = deps.now();
  if (debounced(state, now)) return state;
  if (fuseBlown(state, now)) return tick(state, now);
  if (state.skipsLeft === 0) return state;

  const team = holderTeam(state);
  return {
    ...state,
    currentPhrase: deps.draw(),
    phraseShownAt: now,
    skipsLeft: state.skipsLeft === null ? null : state.skipsLeft - 1,
    lastAdvanceAt: now,
    stats: { ...state.stats, skips: bump(state.stats.skips, team.id) },
  };
}

function showScoreboard(state: GameState): GameState {
  const { teams, targetScore } = state.settings;
  const top = Math.max(...teams.map((t) => state.scores[t.id] ?? 0));
  const leaders = teams.filter((t) => (state.scores[t.id] ?? 0) === top);
  if (top >= targetScore && leaders.length === 1) {
    return { ...state, phase: 'won', winnerTeamId: leaders[0].id };
  }
  return { ...state, phase: 'scoreboard' };
}

function undoLastPoint(state: GameState): GameState {
  const last = state.roundLog[state.roundLog.length - 1];
  if (last === undefined) return state;
  const scores = { ...state.scores };
  for (const t of state.settings.teams) {
    if (t.id !== last.caughtTeamId) scores[t.id] = Math.max(0, (scores[t.id] ?? 0) - 1);
  }
  return {
    ...state,
    phase: 'scoreboard',
    scores,
    roundLog: state.roundLog.slice(0, -1),
    winnerTeamId: null,
  };
}

export function reduce(state: GameState, action: Action, deps: EngineDeps): GameState {
  switch (action.type) {
    case 'START_ROUND':
      return state.phase === 'setup' ? startRound(state, deps) : state;

    case 'NEXT_ROUND': {
      if (state.phase !== 'scoreboard') return state;
      const prev = holderTeam(state);
      return startRound(
        { ...state, holderTeamIndex: nextTeamIndex(state), playerCursor: bump(state.playerCursor, prev.id) },
        deps,
      );
    }

    case 'GOT_IT':
      return state.phase === 'playing' ? gotIt(state, deps) : state;

    case 'SKIP':
      return state.phase === 'playing' ? skip(state, deps) : state;

    case 'PAUSE': {
      if (state.phase !== 'playing' || state.fuseEndsAt === null) return state;
      const now = deps.now();
      return {
        ...state,
        phase: 'paused',
        pausedRemainingMs: Math.max(0, state.fuseEndsAt - now),
        fuseEndsAt: null,
      };
    }

    case 'RESUME': {
      if (state.phase !== 'paused' || state.pausedRemainingMs === null) return state;
      const now = deps.now();
      return {
        ...state,
        phase: 'playing',
        fuseEndsAt: now + state.pausedRemainingMs,
        pausedRemainingMs: null,
        phraseShownAt: null,
      };
    }

    case 'TICK':
      return tick(state, action.now);

    case 'SHOW_SCOREBOARD':
      return state.phase === 'caught' ? showScoreboard(state) : state;

    case 'UNDO_LAST_POINT':
      return state.phase === 'caught' || state.phase === 'scoreboard' || state.phase === 'won'
        ? undoLastPoint(state)
        : state;

    case 'END_ROUND_NO_SCORE':
      return state.phase === 'playing' || state.phase === 'paused'
        ? {
            ...state,
            phase: 'scoreboard',
            fuseEndsAt: null,
            fuseDurationMs: null,
            pausedRemainingMs: null,
            phraseShownAt: null,
          }
        : state;

    default:
      return state;
  }
}
