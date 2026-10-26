/**
 * Game engine contract (PRD section 7). FROZEN after Phase 0: changes go through the orchestrator.
 * No React or Expo imports anywhere in src/engine.
 *
 * Additions beyond the PRD's sketch are marked "(orchestrator)"; they exist because the PRD's
 * rules (pause, debounce, undo, chill-mode fuse, seat order) need state the sketch didn't hold.
 */
import type { Phrase } from '../../content/schema';

export type { Phrase };

export type Mode = 'classic' | 'taboo' | 'charades' | 'one-word';

export interface Team {
  id: string;
  name: string;
  /** Hex color from src/ui/tokens TEAM_COLORS. */
  color: string;
  /** Optional player names in seat order. May be empty. */
  players: string[];
}

export interface GameSettings {
  mode: Mode;
  /** 2-4 teams, in seat/turn order. */
  teams: Team[];
  packIds: string[];
  /** default 7 */
  targetScore: number;
  /** null = unlimited */
  skipsPerTurn: number | null;
  /** default 45000 */
  fuseMinMs: number;
  /** default 75000 */
  fuseMaxMs: number;
  /** chill mode: UI may show the remaining fuse */
  showFuse: boolean;
}

/**
 * setup      -> START_ROUND -> playing
 * playing    <-> paused (PAUSE / RESUME)
 * playing    -> TICK past fuseEndsAt -> caught
 * playing|paused -> END_ROUND_NO_SCORE -> scoreboard
 * caught     -> SHOW_SCOREBOARD -> scoreboard, or won if a single team leads at >= targetScore
 * scoreboard -> NEXT_ROUND -> playing
 * caught|scoreboard|won -> UNDO_LAST_POINT -> scoreboard
 */
export type Phase = 'setup' | 'playing' | 'paused' | 'caught' | 'scoreboard' | 'won';

export interface RoundLogEntry {
  caughtTeamId: string;
  at: number;
  /** (orchestrator) Player holding the phone when the fuse blew, if names were entered. */
  caughtPlayer?: string;
}

export interface GameState {
  settings: GameSettings;
  phase: Phase;
  /** teamId -> points */
  scores: Record<string, number>;
  /** Index into settings.teams of the team holding the phone. */
  holderTeamIndex: number;
  currentPhrase: Phrase | null;
  /** Epoch ms when the fuse blows. Engine-internal; UI must not display unless showFuse. null unless playing. */
  fuseEndsAt: number | null;
  /** null = unlimited. Resets each time the phone changes hands. */
  skipsLeft: number | null;
  roundLog: RoundLogEntry[];

  /** (orchestrator) Total fuse length for the current round, ms. Used for tick progress. null outside a round. */
  fuseDurationMs: number | null;
  /** (orchestrator) Fuse ms left when paused; fuseEndsAt is null while paused. */
  pausedRemainingMs: number | null;
  /** (orchestrator) Time of the last accepted GOT_IT/SKIP, for the 300 ms double-tap guard. */
  lastAdvanceAt: number | null;
  /** (orchestrator) teamId -> index into that team's players[] of whoever holds/next holds the phone. */
  playerCursor: Record<string, number>;
  /** (orchestrator) Round number, 1-based; 0 before the first round. */
  round: number;
  /** (orchestrator) Winning team id once phase === 'won'. */
  winnerTeamId: string | null;
  /** (orchestrator) Per-round stats for P1 game stats; append-only. */
  stats: {
    /** Phrases guessed per team. */
    gotIt: Record<string, number>;
    skips: Record<string, number>;
    /** Fastest GOT_IT (ms since the phrase appeared) and who did it. */
    fastest: { teamId: string; ms: number; player?: string } | null;
  };
  /** (orchestrator) When currentPhrase appeared (epoch ms); for fastest-guess stats. */
  phraseShownAt: number | null;
}

export type Action =
  | { type: 'START_ROUND' }
  | { type: 'GOT_IT' }
  | { type: 'SKIP' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'TICK'; now: number }
  | { type: 'UNDO_LAST_POINT' }
  | { type: 'NEXT_ROUND' }
  | { type: 'END_ROUND_NO_SCORE' }
  /** (orchestrator) Leave the Caught screen. */
  | { type: 'SHOW_SCOREBOARD' };

export interface EngineDeps {
  /** Current epoch ms. Injected so tests control time. */
  now(): number;
  /** Uniform [0, 1). Injected so tests can seed. */
  rng(): number;
  /** Next phrase (ContentService drawer). */
  draw(): Phrase;
}

/** Engine entry points, implemented in src/engine/index.ts. */
export type Reduce = (state: GameState, action: Action, deps: EngineDeps) => GameState;
export type CreateGame = (settings: GameSettings) => GameState;
