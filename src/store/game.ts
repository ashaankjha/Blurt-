/**
 * Game store. Phase 0 MOCK: fakes phase transitions so screens are navigable without the engine.
 * Agent G replaces the internals with the real engine/content/audio wiring, keeping `useGame`.
 */
import { create } from 'zustand';

import { DEFAULTS } from '../config';
import { createGame } from '../engine';
import type { GameSettings, Team } from '../engine/types';
import { TEAM_COLORS } from '../ui/tokens';
import type { GameStore } from './gameTypes';

export * from './gameTypes';

const makeTeam = (i: number): Team => ({
  id: `team-${i + 1}`,
  name: `Team ${TEAM_COLORS[i].name}`,
  color: TEAM_COLORS[i].hex,
  players: [],
});

export const defaultDraft = (): GameSettings => ({
  mode: 'classic',
  teams: [0, 1].map(makeTeam),
  packIds: [],
  targetScore: DEFAULTS.targetScore,
  skipsPerTurn: DEFAULTS.skipsPerTurn,
  fuseMinMs: DEFAULTS.fuseMinMs,
  fuseMaxMs: DEFAULTS.fuseMaxMs,
  showFuse: DEFAULTS.showFuse,
});

const MOCK_PHRASE = { id: 'mock:pizza', text: 'Pizza', difficulty: 1 as const };

export const useGame = create<GameStore>()((set, get) => ({
  draft: defaultDraft(),
  game: null,

  resetDraft: () => set({ draft: defaultDraft() }),
  setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  addTeam: () =>
    set((s) =>
      s.draft.teams.length >= 4
        ? s
        : { draft: { ...s.draft, teams: [...s.draft.teams, makeTeam(s.draft.teams.length)] } },
    ),
  removeTeam: (teamId) =>
    set((s) =>
      s.draft.teams.length <= 2 ? s : { draft: { ...s.draft, teams: s.draft.teams.filter((t) => t.id !== teamId) } },
    ),
  updateTeam: (teamId, patch) =>
    set((s) => ({
      draft: { ...s.draft, teams: s.draft.teams.map((t) => (t.id === teamId ? { ...t, ...patch } : t)) },
    })),
  shuffleSeats: () => {},
  togglePack: (packId) =>
    set((s) => {
      const has = s.draft.packIds.includes(packId);
      return {
        draft: {
          ...s.draft,
          packIds: has ? s.draft.packIds.filter((p) => p !== packId) : [...s.draft.packIds, packId],
        },
      };
    }),
  setPacks: (packIds) => set((s) => ({ draft: { ...s.draft, packIds } })),

  quickPlay: () => {
    set({ draft: { ...defaultDraft(), packIds: ['food-drink', 'animals'] } });
    get().startGame();
  },
  startGame: () => {
    const g = createGame(get().draft);
    set({ game: { ...g, phase: 'playing', round: 1, currentPhrase: MOCK_PHRASE } });
  },
  gotIt: () =>
    set((s) =>
      s.game
        ? { game: { ...s.game, holderTeamIndex: (s.game.holderTeamIndex + 1) % s.game.settings.teams.length } }
        : s,
    ),
  skip: () => {},
  pause: () => set((s) => (s.game ? { game: { ...s.game, phase: 'paused' } } : s)),
  resume: () => set((s) => (s.game ? { game: { ...s.game, phase: 'playing' } } : s)),
  endRoundNoScore: () => set((s) => (s.game ? { game: { ...s.game, phase: 'scoreboard' } } : s)),
  showScoreboard: () => set((s) => (s.game ? { game: { ...s.game, phase: 'scoreboard' } } : s)),
  nextRound: () => set((s) => (s.game ? { game: { ...s.game, phase: 'playing', round: s.game.round + 1 } } : s)),
  undoLastPoint: () => {},
  playAgain: () => get().startGame(),
  quitGame: () => set({ game: null }),
}));
