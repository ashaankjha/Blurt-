import { EVERYTHING_MIX_ID } from '../config';
import { contentService, createMemoryKV } from '../content';
import { mulberry32 } from '../engine';
import type { AudioService } from '../audio/types';
import type { GameState, Phrase } from '../engine/types';
import { TEAM_COLORS } from '../ui/tokens';
import { createGameStore, FUSE_TICK_MS, type GameStoreDeps, type GameStoreInstance } from './game';
import { shuffleSeats } from './gameDraft';
import { pauseOnBackground, syncAudioSettings } from './gameLifecycle';
import { createSettingsStore } from './settings';

const T0 = 1_700_000_000_000;

function makeAudio() {
  return {
    preload: jest.fn(async () => {}),
    startTicking: jest.fn(),
    stopTicking: jest.fn(),
    playBuzzer: jest.fn(),
    playSfx: jest.fn(),
    haptic: jest.fn(),
    listBuzzers: jest.fn(() => []),
    configure: jest.fn(),
  } satisfies AudioService;
}

function makeContent() {
  let n = 0;
  const createDrawer = jest.fn((packIds: string[]) => (): Phrase => {
    n += 1;
    return { id: `${packIds[0]}:p${n}`, text: `Phrase ${n}`, difficulty: 1 };
  });
  return { createDrawer };
}

interface Harness {
  store: GameStoreInstance;
  audio: ReturnType<typeof makeAudio>;
  content: ReturnType<typeof makeContent>;
  settings: ReturnType<typeof createSettingsStore>;
  game: () => GameState;
}

function setup(opts: { fuseMs?: number; target?: number; extra?: Partial<GameStoreDeps> } = {}): Harness {
  const settings = createSettingsStore(createMemoryKV());
  const fuse = opts.fuseMs ?? 10_000;
  settings.getState().setDefaultRules({ fuseMinMs: fuse, fuseMaxMs: fuse, targetScore: opts.target ?? 7 });
  const audio = makeAudio();
  const content = makeContent();
  const store = createGameStore({
    now: () => Date.now(),
    rng: mulberry32(42),
    content,
    audio,
    settings,
    ...opts.extra,
  });
  return {
    store,
    audio,
    content,
    settings,
    game: () => {
      const g = store.getState().game;
      if (!g) throw new Error('no game');
      return g;
    },
  };
}

const sfxCount = (audio: ReturnType<typeof makeAudio>, kind: string) =>
  audio.playSfx.mock.calls.filter(([k]) => k === kind).length;

/** Lets the fuse burn down until the round is caught. */
function burnFuse(h: Harness) {
  const g = h.game();
  expect(g.phase).toBe('playing');
  jest.advanceTimersByTime((g.fuseEndsAt ?? 0) - Date.now() + FUSE_TICK_MS);
  expect(h.game().phase).toBe('caught');
}

let current: Harness | null = null;

beforeEach(() => {
  jest.useFakeTimers({ now: T0 });
});

afterEach(() => {
  current?.store.getState().quitGame();
  current = null;
  jest.useRealTimers();
});

const make = (opts?: Parameters<typeof setup>[0]) => (current = setup(opts));

describe('quick play', () => {
  it('reaches playing with a phrase in one call, using Everything Mix and the saved rules', () => {
    const h = make({ target: 5 });
    h.store.getState().quickPlay();
    const g = h.game();
    expect(g.phase).toBe('playing');
    expect(g.round).toBe(1);
    expect(g.currentPhrase?.text).toBeTruthy();
    expect(g.settings.packIds).toEqual([EVERYTHING_MIX_ID]);
    expect(g.settings.teams).toHaveLength(2);
    expect(g.settings.targetScore).toBe(5);
    expect(h.content.createDrawer).toHaveBeenCalledWith([EVERYTHING_MIX_ID], expect.any(Function));
    expect(h.audio.startTicking).toHaveBeenCalled();
  });

  it('never includes adult packs, even with After Dark on (real content)', () => {
    const settings = createSettingsStore(createMemoryKV());
    settings.getState().set('afterDarkEnabled', true);
    settings.getState().setDefaultRules({ fuseMinMs: 600_000, fuseMaxMs: 600_000 });
    const drawn: Phrase[] = [];
    const store = createGameStore({
      now: () => Date.now(),
      rng: mulberry32(7),
      audio: makeAudio(),
      settings,
      content: {
        createDrawer: (ids, rng) => {
          const draw = contentService.createDrawer(ids, rng);
          return () => {
            const p = draw();
            drawn.push(p);
            return p;
          };
        },
      },
    });
    current = { store } as Harness;
    store.getState().quickPlay();
    for (let i = 0; i < 150; i++) {
      jest.advanceTimersByTime(400);
      store.getState().gotIt();
    }
    expect(store.getState().game?.settings.packIds).toEqual([EVERYTHING_MIX_ID]);
    expect(drawn.length).toBe(151);
    const adult = new Set(
      contentService
        .listPacks({ includeAdult: true })
        .filter((p) => p.tags.includes('adult'))
        .map((p) => p.id),
    );
    expect(adult.size).toBeGreaterThan(0);
    for (const p of drawn) expect(adult.has(p.id.split(':')[0])).toBe(false);
  });
});

describe('fuse loop', () => {
  it('ticks while playing, then caught -> buzzer + haptic, and the loop stops', () => {
    const h = make({ fuseMs: 10_000 });
    h.settings.getState().set('buzzerId', 'kaboom');
    h.store.getState().quickPlay();

    jest.advanceTimersByTime(1_000);
    // startTicking at least every 250 ms with growing progress.
    const progress = h.audio.startTicking.mock.calls.map(([p]) => p);
    expect(progress.length).toBeGreaterThanOrEqual(1_000 / 250);
    expect(progress[progress.length - 1]).toBeGreaterThan(progress[0]);
    expect(progress[progress.length - 1]).toBeCloseTo(0.1, 1);

    jest.advanceTimersByTime(8_800);
    expect(h.game().phase).toBe('playing');
    expect(h.audio.playBuzzer).not.toHaveBeenCalled();

    jest.advanceTimersByTime(300);
    expect(h.game().phase).toBe('caught');
    expect(h.audio.stopTicking).toHaveBeenCalled();
    expect(h.audio.playBuzzer).toHaveBeenCalledTimes(1);
    expect(h.audio.playBuzzer).toHaveBeenCalledWith('kaboom');
    expect(h.audio.haptic).toHaveBeenCalledWith('caught');

    const ticks = h.audio.startTicking.mock.calls.length;
    jest.advanceTimersByTime(5_000);
    expect(h.audio.startTicking.mock.calls.length).toBe(ticks);
    expect(h.audio.playBuzzer).toHaveBeenCalledTimes(1);
  });

  it('pause freezes the fuse and stops ticking; resume continues where it left off', () => {
    const h = make({ fuseMs: 10_000 });
    h.store.getState().quickPlay();
    jest.advanceTimersByTime(4_000);
    h.audio.stopTicking.mockClear();

    h.store.getState().pause();
    expect(h.game().phase).toBe('paused');
    expect(h.audio.stopTicking).toHaveBeenCalled();
    const ticks = h.audio.startTicking.mock.calls.length;

    jest.advanceTimersByTime(60_000);
    expect(h.game().phase).toBe('paused');
    expect(h.audio.startTicking.mock.calls.length).toBe(ticks);
    expect(h.audio.playBuzzer).not.toHaveBeenCalled();

    h.store.getState().resume();
    expect(h.game().phase).toBe('playing');
    expect(h.audio.startTicking.mock.calls.length).toBeGreaterThan(ticks);
    jest.advanceTimersByTime(5_800);
    expect(h.game().phase).toBe('playing');
    jest.advanceTimersByTime(400);
    expect(h.game().phase).toBe('caught');
  });

  it('end round (no score) stops ticking and nobody scores', () => {
    const h = make();
    h.store.getState().quickPlay();
    h.audio.stopTicking.mockClear();
    h.store.getState().endRoundNoScore();
    expect(h.game().phase).toBe('scoreboard');
    expect(h.audio.stopTicking).toHaveBeenCalled();
    expect(Object.values(h.game().scores)).toEqual([0, 0]);
    jest.advanceTimersByTime(60_000);
    expect(h.audio.playBuzzer).not.toHaveBeenCalled();
  });
});

describe('got it / skip', () => {
  it('a double tap inside 300 ms advances once and plays gotIt once', () => {
    const h = make();
    h.store.getState().quickPlay();
    const first = h.game().currentPhrase;
    jest.advanceTimersByTime(1_000);
    h.store.getState().gotIt();
    h.store.getState().gotIt();
    jest.advanceTimersByTime(100);
    h.store.getState().gotIt();
    expect(sfxCount(h.audio, 'gotIt')).toBe(1);
    expect(h.audio.haptic.mock.calls.filter(([k]) => k === 'success')).toHaveLength(1);
    expect(h.game().currentPhrase).not.toEqual(first);
    expect(h.game().holderTeamIndex).toBe(1);

    jest.advanceTimersByTime(300);
    h.store.getState().gotIt();
    expect(sfxCount(h.audio, 'gotIt')).toBe(2);
    expect(h.game().holderTeamIndex).toBe(0);
  });

  it('skip plays the skip sfx and respects the skip limit', () => {
    const h = make();
    h.settings.getState().setDefaultRules({ skipsPerTurn: 1 });
    h.store.getState().quickPlay();
    jest.advanceTimersByTime(500);
    h.store.getState().skip();
    expect(sfxCount(h.audio, 'skip')).toBe(1);
    expect(h.game().skipsLeft).toBe(0);
    jest.advanceTimersByTime(500);
    h.store.getState().skip();
    expect(sfxCount(h.audio, 'skip')).toBe(1);
  });

  it('a late Got it after the fuse blew resolves as the catch (buzzer, no gotIt sound)', () => {
    const h = make({ fuseMs: 10_000, extra: { tickMs: 10_000_000 } });
    h.store.getState().quickPlay();
    jest.setSystemTime(T0 + 10_050);
    h.store.getState().gotIt();
    expect(h.game().phase).toBe('caught');
    expect(sfxCount(h.audio, 'gotIt')).toBe(0);
    expect(h.audio.playBuzzer).toHaveBeenCalledTimes(1);
  });
});

describe('scoring', () => {
  it.each([2, 3, 4])('with %i teams every team except the caught one scores', (n) => {
    const h = make();
    for (let i = 2; i < n; i++) h.store.getState().addTeam();
    h.store.getState().setPacks(['animals']);
    h.store.getState().startGame();
    const g0 = h.game();
    expect(g0.settings.teams).toHaveLength(n);
    // Pass the phone a couple of times so the holder isn't trivially team 0.
    jest.advanceTimersByTime(1_000);
    h.store.getState().gotIt();
    const caught = h.game().settings.teams[h.game().holderTeamIndex].id;
    burnFuse(h);
    const scores = h.game().scores;
    for (const t of g0.settings.teams) expect(scores[t.id]).toBe(t.id === caught ? 0 : 1);
    expect(h.game().roundLog[0].caughtTeamId).toBe(caught);

    h.store.getState().showScoreboard();
    expect(h.game().phase).toBe('scoreboard');
    expect(sfxCount(h.audio, 'point')).toBe(1);
  });

  it('undo restores the prior score', () => {
    const h = make();
    h.store.getState().quickPlay();
    burnFuse(h);
    h.store.getState().showScoreboard();
    expect(Object.values(h.game().scores).sort()).toEqual([0, 1]);
    h.store.getState().undoLastPoint();
    expect(h.game().phase).toBe('scoreboard');
    expect(Object.values(h.game().scores)).toEqual([0, 0]);
    expect(h.game().roundLog).toHaveLength(0);
    // Nothing left to undo: ignored.
    const g = h.game();
    h.store.getState().undoLastPoint();
    expect(h.game()).toBe(g);
  });

  it('plays to the target: won exactly at the target score, with the win sfx', () => {
    const h = make({ target: 3, fuseMs: 5_000 });
    h.store.getState().quickPlay();
    for (let round = 0; round < 20; round++) {
      burnFuse(h);
      const top = Math.max(...Object.values(h.game().scores));
      h.store.getState().showScoreboard();
      if (h.game().phase === 'won') {
        expect(top).toBe(3);
        break;
      }
      expect(top).toBeLessThan(3);
      expect(h.game().phase).toBe('scoreboard');
      h.store.getState().nextRound();
      expect(h.game().phase).toBe('playing');
    }
    const g = h.game();
    expect(g.phase).toBe('won');
    expect(g.scores[g.winnerTeamId!]).toBe(3);
    expect(sfxCount(h.audio, 'win')).toBe(1);
  });

  it('play again keeps settings and starts a fresh round 1 with a new drawer', () => {
    const h = make({ target: 1, fuseMs: 5_000 });
    h.store.getState().updateTeam('team-1', { name: 'Llamas', players: ['Ann', 'Bo'] });
    h.store.getState().setDraft({ skipsPerTurn: null, showFuse: true });
    h.store.getState().setPacks(['movies', 'animals']);
    h.store.getState().startGame();
    burnFuse(h);
    h.store.getState().showScoreboard();
    expect(h.game().phase).toBe('won');
    const settings = h.game().settings;

    h.store.getState().playAgain();
    const g = h.game();
    expect(g.phase).toBe('playing');
    expect(g.round).toBe(1);
    expect(g.settings).toEqual(settings);
    expect(Object.values(g.scores).every((s) => s === 0)).toBe(true);
    expect(g.roundLog).toEqual([]);
    expect(h.content.createDrawer).toHaveBeenCalledTimes(2);
    expect(h.content.createDrawer).toHaveBeenLastCalledWith(['movies', 'animals'], expect.any(Function));
  });

  it('quitGame clears the game and silences the fuse', () => {
    const h = make();
    h.store.getState().quickPlay();
    h.audio.stopTicking.mockClear();
    h.store.getState().quitGame();
    expect(h.store.getState().game).toBeNull();
    expect(h.audio.stopTicking).toHaveBeenCalled();
    jest.advanceTimersByTime(60_000);
    expect(h.audio.playBuzzer).not.toHaveBeenCalled();
  });
});

describe('draft', () => {
  it('defaults come from settings (rules + last packs); startGame saves lastPackIds', () => {
    const settings = createSettingsStore(createMemoryKV());
    settings.getState().setDefaultRules({ targetScore: 11, skipsPerTurn: 0, showFuse: true });
    settings.getState().set('lastPackIds', ['movies']);
    const store = createGameStore({ settings, audio: makeAudio(), content: makeContent() });
    current = { store } as Harness;
    const { draft } = store.getState();
    expect(draft).toMatchObject({ targetScore: 11, skipsPerTurn: 0, showFuse: true, packIds: ['movies'] });
    expect(draft.teams.map((t) => t.color)).toEqual([TEAM_COLORS[0].hex, TEAM_COLORS[1].hex]);

    store.getState().togglePack('animals');
    store.getState().togglePack('movies');
    store.getState().startGame();
    expect(store.getState().game?.phase).toBe('playing');
    expect(settings.getState().lastPackIds).toEqual(['animals']);
  });

  it('startGame with no packs does nothing', () => {
    const h = make();
    h.store.getState().setPacks([]);
    h.store.getState().startGame();
    expect(h.store.getState().game).toBeNull();
  });

  it('addTeam picks the first unused color, never a duplicate, and caps at 4 teams', () => {
    const h = make();
    // The user gave team 1 the color addTeam would otherwise pick next.
    h.store.getState().updateTeam('team-1', { color: TEAM_COLORS[2].hex });
    h.store.getState().addTeam();
    h.store.getState().addTeam();
    h.store.getState().addTeam();
    const teams = h.store.getState().draft.teams;
    expect(teams).toHaveLength(4);
    const colors = teams.map((t) => t.color);
    expect(new Set(colors).size).toBe(4);
    expect(colors[2]).toBe(TEAM_COLORS[0].hex);
    expect(colors[3]).toBe(TEAM_COLORS[3].hex);
    expect(new Set(teams.map((t) => t.id)).size).toBe(4);

    h.store.getState().removeTeam(teams[0].id);
    h.store.getState().addTeam();
    const again = h.store.getState().draft.teams;
    expect(new Set(again.map((t) => t.color)).size).toBe(4);
    expect(new Set(again.map((t) => t.id)).size).toBe(4);
  });

  it('shuffleSeats redistributes every named player as evenly as possible', () => {
    const h = make();
    h.store.getState().addTeam();
    h.store.getState().updateTeam('team-1', { players: ['Ann', 'Bo', 'Cy', 'Di', ' '] });
    h.store.getState().updateTeam('team-2', { players: ['Ed'] });
    h.store.getState().updateTeam('team-3', { players: [] });
    h.store.getState().shuffleSeats();
    const teams = h.store.getState().draft.teams;
    const sizes = teams.map((t) => t.players.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    expect(
      teams
        .flatMap((t) => t.players)
        .slice()
        .sort(),
    ).toEqual(['Ann', 'Bo', 'Cy', 'Di', 'Ed']);
    expect(teams.map((t) => t.name)).toEqual(['Team Blue', 'Team Orange', 'Team Pink']);
  });

  it('shuffleSeats produces different seatings over seeds', () => {
    const teams = [
      { id: 'a', name: 'A', color: '#000', players: ['1', '2', '3'] },
      { id: 'b', name: 'B', color: '#111', players: ['4', '5', '6'] },
    ];
    const seen = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      seen.add(JSON.stringify(shuffleSeats(teams, mulberry32(seed)).map((t) => t.players)));
    }
    expect(seen.size).toBeGreaterThan(5);
  });
});

describe('lifecycle', () => {
  function fakeAppState() {
    const listeners: Record<string, ((s?: string) => void)[]> = {};
    return {
      addEventListener: jest.fn((type: string, fn: (s?: string) => void) => {
        (listeners[type] ??= []).push(fn);
        return { remove: () => (listeners[type] = listeners[type].filter((f) => f !== fn)) };
      }),
      emit: (type: string, s?: string) => (listeners[type] ?? []).forEach((f) => f(s)),
      count: () => Object.values(listeners).flat().length,
    };
  }

  it.each(['background', 'inactive'])('going %s pauses a playing round; no auto-resume', (state) => {
    const h = make();
    const app = fakeAppState();
    const off = pauseOnBackground(h.store, app as never, 'ios');
    h.store.getState().quickPlay();
    app.emit('change', state);
    expect(h.game().phase).toBe('paused');
    app.emit('change', 'active');
    expect(h.game().phase).toBe('paused');
    off();
    expect(app.count()).toBe(0);
  });

  it('Android blur (e.g. incoming call screen) pauses', () => {
    const h = make();
    const app = fakeAppState();
    const off = pauseOnBackground(h.store, app as never, 'android');
    h.store.getState().quickPlay();
    app.emit('blur');
    expect(h.game().phase).toBe('paused');
    off();
  });

  it('backgrounding outside a round does nothing', () => {
    const h = make();
    const app = fakeAppState();
    const off = pauseOnBackground(h.store, app as never, 'ios');
    app.emit('change', 'background');
    expect(h.store.getState().game).toBeNull();
    h.store.getState().quickPlay();
    burnFuse(h);
    app.emit('change', 'background');
    expect(h.game().phase).toBe('caught');
    off();
  });

  it('syncs audio settings at install and on relevant changes only', () => {
    const settings = createSettingsStore(createMemoryKV());
    const audio = makeAudio();
    const off = syncAudioSettings(settings, audio);
    expect(audio.configure).toHaveBeenLastCalledWith({
      soundEnabled: true,
      volume: 1,
      hapticsEnabled: true,
      respectSilentMode: false,
    });
    settings.getState().set('volume', 0.5);
    expect(audio.configure).toHaveBeenCalledTimes(2);
    expect(audio.configure).toHaveBeenLastCalledWith(expect.objectContaining({ volume: 0.5 }));
    settings.getState().set('lastPackIds', ['movies']);
    expect(audio.configure).toHaveBeenCalledTimes(2);
    settings.getState().set('hapticsEnabled', false);
    expect(audio.configure).toHaveBeenLastCalledWith(expect.objectContaining({ hapticsEnabled: false }));
    off();
    settings.getState().set('soundEnabled', false);
    expect(audio.configure).toHaveBeenCalledTimes(3);
  });
});
