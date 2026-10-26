/**
 * Game store: the only gameplay API screens use (contract: ./gameTypes.ts).
 *
 * Holds the Setup draft and the live game. Every gameplay action goes through the pure engine
 * reducer (`src/engine`), with a per-game phrase drawer from the content service. The store also
 * runs the fuse loop (TICK every ~100 ms while playing, which also drives the audio tick tempo)
 * and fires sounds and haptics on real engine transitions only (the engine returns the same
 * object for ignored actions, so identity tells us whether anything happened).
 *
 * `createGameStore(deps)` builds an instance with injected clock, RNG, content, audio and
 * settings (tests); `useGame` is the app's default instance. See src/store/HANDOFF.md.
 */
import { create, type StoreApi, type UseBoundStore } from 'zustand';

import { audioService } from '../audio';
import type { AudioService } from '../audio/types';
import { contentService } from '../content';
import type { ContentService } from '../content/types';
import { createGame, fuseProgress, reduce } from '../engine';
import type { Action, EngineDeps, GameSettings, GameState, Phrase } from '../engine/types';
import {
  draftFromSettings,
  finalizeSettings,
  makeNextTeam,
  quickPlaySettings,
  shuffleSeats as shuffleTeamSeats,
} from './gameDraft';
import type { GameStore } from './gameTypes';
import { reviewPrompt } from './review';
import { useSettings } from './settings';
import type { SettingsStore } from './settingsTypes';

export * from './gameTypes';
export { defaultTeams, makeNextTeam, quickPlaySettings, shuffled } from './gameDraft';

/** How often the fuse loop dispatches TICK while a round is playing. */
export const FUSE_TICK_MS = 100;

export interface GameStoreDeps {
  /** Epoch ms. Default `Date.now()` (read on each call, so Jest fake timers apply). */
  now: () => number;
  /** Uniform [0, 1). Default Math.random; tests pass `mulberry32(seed)`. */
  rng: () => number;
  content: Pick<ContentService, 'createDrawer'>;
  audio: AudioService;
  settings: Pick<StoreApi<SettingsStore>, 'getState'>;
  /** Fuse loop period, ms. Default FUSE_TICK_MS. */
  tickMs: number;
  /** Called once per game, the first time it is won. Default: counts it for the review prompt. */
  onGameCompleted: () => void;
}

export type GameStoreInstance = UseBoundStore<StoreApi<GameStore>>;

function warn(message: string, error: unknown) {
  if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn(`[game] ${message}`, error);
}

export function createGameStore(overrides: Partial<GameStoreDeps> = {}): GameStoreInstance {
  const deps: GameStoreDeps = {
    now: () => Date.now(),
    rng: Math.random,
    content: contentService,
    audio: audioService,
    settings: useSettings,
    tickMs: FUSE_TICK_MS,
    onGameCompleted: () => reviewPrompt.recordCompletedGame(),
    ...overrides,
  };
  const { audio } = deps;

  /** Draw function for the current game (one drawer per game, so no repeats within a game). */
  let drawer: (() => Phrase) | null = null;
  let loop: ReturnType<typeof setInterval> | null = null;
  /** Whether the current game already counted as completed (undo + a second win counts once). */
  let completedCounted = false;

  const engineDeps: EngineDeps = {
    now: () => deps.now(),
    rng: () => deps.rng(),
    draw: () => {
      if (!drawer) throw new Error('No phrase drawer: the game was not started through the store');
      return drawer();
    },
  };

  const freshDraft = (): GameSettings => {
    const s = deps.settings.getState();
    return draftFromSettings(s.defaultRules, s.lastPackIds);
  };

  return create<GameStore>()((set, get) => {
    // ---- fuse loop ---------------------------------------------------------------------------

    const stopLoop = () => {
      if (loop !== null) {
        clearInterval(loop);
        loop = null;
      }
    };

    /** One loop step: blow the fuse if due, else feed the current progress to the tick tempo. */
    const step = () => {
      const game = get().game;
      if (!game || game.phase !== 'playing') {
        syncLoop(game);
        return;
      }
      const now = deps.now();
      const next = commit({ type: 'TICK', now });
      if (next && next.phase === 'playing') audio.startTicking(fuseProgress(next, now));
    };

    /** Runs the loop exactly while the phase is 'playing'; anything else silences the ticks. */
    const syncLoop = (game: GameState | null) => {
      if (game?.phase === 'playing') {
        if (loop === null) {
          loop = setInterval(step, deps.tickMs);
          audio.startTicking(fuseProgress(game, deps.now()));
        }
      } else if (loop !== null) {
        stopLoop();
        audio.stopTicking();
      }
    };

    // ---- transitions -------------------------------------------------------------------------

    /** Sounds and haptics for a real transition (prev !== next). */
    const effects = (prev: GameState | null, next: GameState, action: Action['type'] | 'NEW_GAME') => {
      if (next.phase === 'caught' && prev?.phase !== 'caught') {
        stopLoop();
        audio.stopTicking();
        audio.playBuzzer(deps.settings.getState().buzzerId);
        audio.haptic('caught');
        return;
      }
      if (next.phase === 'playing' && prev?.phase === 'playing') {
        if (action === 'GOT_IT') {
          audio.playSfx('gotIt');
          audio.haptic('success');
        } else if (action === 'SKIP') {
          audio.playSfx('skip');
        }
        return;
      }
      if (action === 'SHOW_SCOREBOARD' && prev?.phase === 'caught') {
        if (next.phase === 'won') {
          audio.playSfx('win');
          if (!completedCounted) {
            completedCounted = true;
            try {
              deps.onGameCompleted();
            } catch (e) {
              warn('onGameCompleted failed', e);
            }
          }
        } else if (next.phase === 'scoreboard') audio.playSfx('point');
      }
    };

    /** Stores a new game state, fires effects and keeps the fuse loop in step with the phase. */
    const setGame = (next: GameState | null, action: Action['type'] | 'NEW_GAME') => {
      const prev = get().game;
      if (next === prev) return;
      set({ game: next });
      if (next) effects(prev, next, action);
      syncLoop(next);
    };

    /** Reduces the live game with the engine. Returns the resulting state (same object if ignored). */
    const commit = (action: Action): GameState | null => {
      const prev = get().game;
      if (!prev) return null;
      let next: GameState;
      try {
        next = reduce(prev, action, engineDeps);
      } catch (e) {
        // Only draw() can throw (empty pack selection); never crash mid-party.
        warn(`${action.type} failed`, e);
        return prev;
      }
      if (next !== prev) setGame(next, action.type);
      return next;
    };

    /** Creates a game from settings with a fresh drawer and starts round 1. */
    const launch = (settings: GameSettings): boolean => {
      const ready = finalizeSettings(settings);
      if (!ready) return false;
      let nextDrawer: () => Phrase;
      let started: GameState;
      try {
        nextDrawer = deps.content.createDrawer(ready.packIds, engineDeps.rng);
        const prevDrawer = drawer;
        drawer = nextDrawer;
        try {
          started = reduce(createGame(ready), { type: 'START_ROUND' }, engineDeps);
        } catch (e) {
          drawer = prevDrawer;
          throw e;
        }
      } catch (e) {
        warn('could not start a game', e);
        return false;
      }
      // Leaving an old game: silence it before the new round starts its own loop.
      stopLoop();
      audio.stopTicking();
      completedCounted = false;
      setGame(started, 'NEW_GAME');
      return true;
    };

    // ---- the store ---------------------------------------------------------------------------

    return {
      draft: freshDraft(),
      game: null,

      resetDraft: () => set({ draft: freshDraft() }),
      setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
      addTeam: () =>
        set((s) => {
          if (s.draft.teams.length >= 4) return s;
          const team = makeNextTeam(s.draft.teams);
          return team ? { draft: { ...s.draft, teams: [...s.draft.teams, team] } } : s;
        }),
      removeTeam: (teamId) =>
        set((s) =>
          s.draft.teams.length <= 2
            ? s
            : { draft: { ...s.draft, teams: s.draft.teams.filter((t) => t.id !== teamId) } },
        ),
      updateTeam: (teamId, patch) =>
        set((s) => ({
          draft: { ...s.draft, teams: s.draft.teams.map((t) => (t.id === teamId ? { ...t, ...patch } : t)) },
        })),
      shuffleSeats: () => set((s) => ({ draft: { ...s.draft, teams: shuffleTeamSeats(s.draft.teams, deps.rng) } })),
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
      setPacks: (packIds) => set((s) => ({ draft: { ...s.draft, packIds: [...packIds] } })),

      quickPlay: () => {
        launch(quickPlaySettings(deps.settings.getState().defaultRules));
      },
      startGame: () => {
        const { draft } = get();
        if (launch(draft)) deps.settings.getState().set('lastPackIds', [...new Set(draft.packIds)]);
      },
      gotIt: () => {
        commit({ type: 'GOT_IT' });
      },
      skip: () => {
        commit({ type: 'SKIP' });
      },
      pause: () => {
        commit({ type: 'PAUSE' });
      },
      resume: () => {
        commit({ type: 'RESUME' });
      },
      endRoundNoScore: () => {
        commit({ type: 'END_ROUND_NO_SCORE' });
      },
      showScoreboard: () => {
        commit({ type: 'SHOW_SCOREBOARD' });
      },
      nextRound: () => {
        commit({ type: 'NEXT_ROUND' });
      },
      undoLastPoint: () => {
        commit({ type: 'UNDO_LAST_POINT' });
      },
      playAgain: () => {
        const game = get().game;
        if (game) launch(game.settings);
      },
      quitGame: () => {
        stopLoop();
        audio.stopTicking();
        drawer = null;
        set({ game: null });
      },
    };
  });
}

/** The app's game store. */
export const useGame: GameStoreInstance = createGameStore();
