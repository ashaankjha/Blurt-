/**
 * Game store contract: the only API screens in app/ use for gameplay. FROZEN after Phase 0.
 * Phase 0 ships a mock (src/store/game.ts); Agent G wires it to engine + content + audio.
 */
import type { GameSettings, GameState, Team } from '../engine/types';

export interface GameStore {
  /** Settings being edited on Setup / Pack Picker before a game starts. */
  draft: GameSettings;
  /** Live game, or null when none is in progress. */
  game: GameState | null;

  // Draft editing (Setup + Pack Picker)
  resetDraft(): void;
  setDraft(patch: Partial<GameSettings>): void;
  addTeam(): void;
  removeTeam(teamId: string): void;
  updateTeam(teamId: string, patch: Partial<Omit<Team, 'id'>>): void;
  /** Random seating: shuffles players across teams so teammates alternate seats. */
  shuffleSeats(): void;
  togglePack(packId: string): void;
  setPacks(packIds: string[]): void;

  // Game lifecycle
  /** One tap: 2 teams, all family-safe packs (never adult), default rules; starts round 1. */
  quickPlay(): void;
  /** Create a game from the draft and start round 1. */
  startGame(): void;
  gotIt(): void;
  skip(): void;
  pause(): void;
  resume(): void;
  /** Host-only long-press menu: end the round, nobody scores. */
  endRoundNoScore(): void;
  /** Leave the Caught screen. */
  showScoreboard(): void;
  nextRound(): void;
  undoLastPoint(): void;
  /** New game with identical settings; starts round 1. */
  playAgain(): void;
  /** Abandon the game and return to Home. */
  quitGame(): void;
}
