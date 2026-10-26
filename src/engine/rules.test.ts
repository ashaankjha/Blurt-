import { LIMITS } from '../config';
import { createGame, reduce, rollFuseDurationMs } from './rules';
import { deepFreeze, makeDeps, makeSettings, makeTeams, type TestDeps } from './testHelpers';
import type { Action, GameSettings, GameState } from './types';

const D = LIMITS.advanceDebounceMs;

/** Applies actions in order with frozen inputs, so any mutation throws. */
function run(state: GameState, deps: TestDeps, ...actions: Action[]): GameState {
  return actions.reduce((s, a) => reduce(deepFreeze(s), a, deps), state);
}

function started(overrides: Partial<GameSettings> = {}, deps = makeDeps()): [GameState, TestDeps] {
  return [run(createGame(makeSettings(overrides)), deps, { type: 'START_ROUND' }), deps];
}

/** Plays until the fuse blows (TICK at fuseEndsAt). */
function blow(state: GameState, deps: TestDeps): GameState {
  deps.set(state.fuseEndsAt as number);
  return run(state, deps, { type: 'TICK', now: deps.time });
}

describe('createGame', () => {
  it('builds a setup-phase state with zeroed scores and cursors', () => {
    const settings = makeSettings({ teams: makeTeams(3), skipsPerTurn: 1 });
    const g = createGame(settings);
    expect(g).toEqual({
      settings,
      phase: 'setup',
      scores: { red: 0, blue: 0, green: 0 },
      holderTeamIndex: 0,
      currentPhrase: null,
      fuseEndsAt: null,
      skipsLeft: 1,
      roundLog: [],
      fuseDurationMs: null,
      pausedRemainingMs: null,
      lastAdvanceAt: null,
      playerCursor: { red: 0, blue: 0, green: 0 },
      round: 0,
      winnerTeamId: null,
      stats: { gotIt: {}, skips: {}, fastest: null },
      phraseShownAt: null,
    });
  });
});

describe('rollFuseDurationMs', () => {
  const s = makeSettings({ fuseMinMs: 1000, fuseMaxMs: 2000 });
  it('maps rng 0 to min and rng ~1 to max', () => {
    expect(rollFuseDurationMs(s, () => 0)).toBe(1000);
    expect(rollFuseDurationMs(s, () => 0.9999999)).toBe(2000);
    expect(rollFuseDurationMs(s, () => 0.5)).toBe(1500);
  });
  it('returns integers and clamps out-of-range rng values', () => {
    expect(rollFuseDurationMs(s, () => 0.12345)).toBe(Math.round(1000 + 0.12345 * 1000));
    expect(rollFuseDurationMs(s, () => -3)).toBe(1000);
    expect(rollFuseDurationMs(s, () => 7)).toBe(2000);
  });
  it('tolerates min === max and a reversed range', () => {
    expect(rollFuseDurationMs(makeSettings({ fuseMinMs: 5000, fuseMaxMs: 5000 }), () => 0.7)).toBe(5000);
    const d = rollFuseDurationMs(makeSettings({ fuseMinMs: 2000, fuseMaxMs: 1000 }), () => 0.25);
    expect(d).toBe(1250);
  });
});

describe('START_ROUND', () => {
  it('starts round 1 with a fuse, phrase and fresh skips', () => {
    const deps = makeDeps();
    deps.rng = () => 0.5;
    const [g] = started({ fuseMinMs: 10_000, fuseMaxMs: 20_000, skipsPerTurn: 1 }, deps);
    expect(g.phase).toBe('playing');
    expect(g.round).toBe(1);
    expect(g.fuseDurationMs).toBe(15_000);
    expect(g.fuseEndsAt).toBe(deps.time + 15_000);
    expect(g.currentPhrase?.id).toBe('test:p1');
    expect(g.phraseShownAt).toBe(deps.time);
    expect(g.skipsLeft).toBe(1);
    expect(g.lastAdvanceAt).toBeNull();
    expect(g.pausedRemainingMs).toBeNull();
    expect(g.holderTeamIndex).toBe(0);
  });

  it('is ignored outside setup', () => {
    const [g, deps] = started();
    expect(reduce(g, { type: 'START_ROUND' }, deps)).toBe(g);
  });
});

describe('GOT_IT', () => {
  it('passes the phone to the next team and draws a new phrase', () => {
    const [g0, deps] = started({ teams: makeTeams(3), skipsPerTurn: 3 });
    const s0 = run(g0, deps, { type: 'SKIP' });
    expect(s0.skipsLeft).toBe(2);
    deps.advance(4000);
    const g1 = run(s0, deps, { type: 'GOT_IT' });
    expect(g1.holderTeamIndex).toBe(1);
    expect(g1.playerCursor).toEqual({ red: 1, blue: 0, green: 0 });
    expect(g1.currentPhrase?.id).toBe('test:p3');
    expect(g1.phraseShownAt).toBe(deps.time);
    expect(g1.lastAdvanceAt).toBe(deps.time);
    expect(g1.skipsLeft).toBe(3);
    expect(g1.stats.gotIt).toEqual({ red: 1 });
    expect(g1.stats.fastest).toEqual({ teamId: 'red', ms: 4000 });

    deps.advance(1000);
    deps.advance(1000);
    const g2 = run(g1, deps, { type: 'GOT_IT' });
    deps.advance(1000);
    const g3 = run(g2, deps, { type: 'GOT_IT' });
    expect(g3.holderTeamIndex).toBe(0);
    expect(g3.stats.gotIt).toEqual({ red: 1, blue: 1, green: 1 });
    expect(g3.stats.fastest).toEqual({ teamId: 'green', ms: 1000 });
  });

  it('records the player name in fastest when names exist, and keeps a faster record', () => {
    const [g0, deps] = started({ teams: makeTeams(2, true) });
    deps.advance(500);
    const g1 = run(g0, deps, { type: 'GOT_IT' });
    expect(g1.stats.fastest).toEqual({ teamId: 'red', ms: 500, player: 'red-a' });
    deps.advance(900);
    const g2 = run(g1, deps, { type: 'GOT_IT' });
    expect(g2.stats.fastest).toEqual({ teamId: 'red', ms: 500, player: 'red-a' });
    deps.advance(400);
    const g3 = run(g2, deps, { type: 'GOT_IT' });
    expect(g3.stats.fastest).toEqual({ teamId: 'red', ms: 400, player: 'red-b' });
  });

  it('ignores a second advance inside the debounce window', () => {
    const [g0, deps] = started();
    const g1 = run(g0, deps, { type: 'GOT_IT' });
    deps.advance(D - 1);
    expect(reduce(g1, { type: 'GOT_IT' }, deps)).toBe(g1);
    expect(reduce(g1, { type: 'SKIP' }, deps)).toBe(g1);
    deps.advance(1);
    expect(run(g1, deps, { type: 'GOT_IT' }).holderTeamIndex).toBe(0);
  });

  it('does not count fastest when phraseShownAt is null (after a pause)', () => {
    const [g0, deps] = started();
    const g1 = run(g0, deps, { type: 'PAUSE' }, { type: 'RESUME' });
    deps.advance(10);
    const g2 = run(g1, deps, { type: 'GOT_IT' });
    expect(g2.stats.fastest).toBeNull();
    expect(g2.stats.gotIt).toEqual({ red: 1 });
  });

  it('acts as a TICK when the fuse has already blown', () => {
    const [g0, deps] = started();
    deps.set(g0.fuseEndsAt as number);
    const g1 = run(g0, deps, { type: 'GOT_IT' });
    expect(g1.phase).toBe('caught');
    expect(g1.holderTeamIndex).toBe(0);
    expect(g1.scores).toEqual({ red: 0, blue: 1 });
    expect(g1.roundLog).toEqual([{ caughtTeamId: 'red', at: deps.time }]);
    expect(g1.stats.gotIt).toEqual({});
  });

  it('is ignored outside playing', () => {
    const deps = makeDeps();
    const g = createGame(makeSettings());
    expect(reduce(g, { type: 'GOT_IT' }, deps)).toBe(g);
    const p = run(g, deps, { type: 'START_ROUND' }, { type: 'PAUSE' });
    expect(reduce(p, { type: 'GOT_IT' }, deps)).toBe(p);
  });
});

describe('SKIP', () => {
  it('draws a new phrase, decrements skips and keeps the holder', () => {
    const [g0, deps] = started({ skipsPerTurn: 1 });
    deps.advance(1000);
    const g1 = run(g0, deps, { type: 'SKIP' });
    expect(g1.currentPhrase?.id).toBe('test:p2');
    expect(g1.skipsLeft).toBe(0);
    expect(g1.holderTeamIndex).toBe(0);
    expect(g1.stats.skips).toEqual({ red: 1 });
    expect(g1.phraseShownAt).toBe(deps.time);
    expect(g1.lastAdvanceAt).toBe(deps.time);
    deps.advance(1000);
    expect(reduce(g1, { type: 'SKIP' }, deps)).toBe(g1);
  });

  it('is never allowed with 0 skips per turn', () => {
    const [g0, deps] = started({ skipsPerTurn: 0 });
    expect(reduce(g0, { type: 'SKIP' }, deps)).toBe(g0);
  });

  it('is unlimited when skipsPerTurn is null', () => {
    const [g0, deps] = started({ skipsPerTurn: null });
    let g = g0;
    for (let i = 0; i < 20; i++) {
      deps.advance(D);
      g = run(g, deps, { type: 'SKIP' });
    }
    expect(g.skipsLeft).toBeNull();
    expect(g.stats.skips).toEqual({ red: 20 });
    expect(deps.draws).toBe(21);
  });

  it('acts as a TICK when the fuse has already blown', () => {
    const [g0, deps] = started({ skipsPerTurn: 0 });
    deps.set((g0.fuseEndsAt as number) + 5);
    const g1 = run(g0, deps, { type: 'SKIP' });
    expect(g1.phase).toBe('caught');
    expect(g1.roundLog[0].at).toBe(deps.time);
  });

  it('is ignored outside playing', () => {
    const deps = makeDeps();
    const g = createGame(makeSettings());
    expect(reduce(g, { type: 'SKIP' }, deps)).toBe(g);
  });
});

describe('PAUSE / RESUME', () => {
  it('freezes the remaining fuse and resumes from it', () => {
    const [g0, deps] = started();
    const dur = g0.fuseDurationMs as number;
    deps.advance(10_000);
    const p = run(g0, deps, { type: 'PAUSE' });
    expect(p.phase).toBe('paused');
    expect(p.fuseEndsAt).toBeNull();
    expect(p.pausedRemainingMs).toBe(dur - 10_000);
    expect(p.currentPhrase).toEqual(g0.currentPhrase);

    deps.advance(600_000);
    expect(reduce(p, { type: 'TICK', now: deps.time }, deps)).toBe(p);
    const r = run(p, deps, { type: 'RESUME' });
    expect(r.phase).toBe('playing');
    expect(r.fuseEndsAt).toBe(deps.time + dur - 10_000);
    expect(r.pausedRemainingMs).toBeNull();
    expect(r.phraseShownAt).toBeNull();
  });

  it('clamps remaining at 0 when paused after the fuse should have blown', () => {
    const [g0, deps] = started();
    deps.set((g0.fuseEndsAt as number) + 1000);
    const p = run(g0, deps, { type: 'PAUSE' });
    expect(p.pausedRemainingMs).toBe(0);
    const r = run(p, deps, { type: 'RESUME' });
    expect(run(r, deps, { type: 'TICK', now: deps.time }).phase).toBe('caught');
  });

  it('ignores PAUSE outside playing and RESUME outside paused', () => {
    const [g0, deps] = started();
    expect(reduce(g0, { type: 'RESUME' }, deps)).toBe(g0);
    const p = run(g0, deps, { type: 'PAUSE' });
    expect(reduce(p, { type: 'PAUSE' }, deps)).toBe(p);
    const setup = createGame(makeSettings());
    expect(reduce(setup, { type: 'PAUSE' }, deps)).toBe(setup);
  });

  it('ignores PAUSE/RESUME on inconsistent states (defensive)', () => {
    const [g0, deps] = started();
    const broken = { ...g0, fuseEndsAt: null };
    expect(reduce(broken, { type: 'PAUSE' }, deps)).toBe(broken);
    const brokenPaused = { ...g0, phase: 'paused' as const, pausedRemainingMs: null };
    expect(reduce(brokenPaused, { type: 'RESUME' }, deps)).toBe(brokenPaused);
  });
});

describe('TICK', () => {
  it('returns the same object before the fuse blows', () => {
    const [g0, deps] = started();
    expect(reduce(g0, { type: 'TICK', now: (g0.fuseEndsAt as number) - 1 }, deps)).toBe(g0);
  });

  it('catches the holder and scores every other team (2 teams)', () => {
    const [g0, deps] = started();
    const g1 = blow(g0, deps);
    expect(g1.phase).toBe('caught');
    expect(g1.scores).toEqual({ red: 0, blue: 1 });
    expect(g1.roundLog).toEqual([{ caughtTeamId: 'red', at: deps.time }]);
    expect(g1.fuseEndsAt).toBeNull();
    expect(g1.fuseDurationMs).toBeNull();
    expect(g1.currentPhrase).toEqual(g0.currentPhrase);
  });

  it.each([3, 4])('scores every team except the caught one (%i teams)', (n) => {
    const [g0, deps] = started({ teams: makeTeams(n) });
    deps.advance(1000);
    const g1 = run(g0, deps, { type: 'GOT_IT' });
    const g2 = blow(g1, deps);
    const expected = Object.fromEntries(makeTeams(n).map((t) => [t.id, t.id === 'blue' ? 0 : 1]));
    expect(g2.scores).toEqual(expected);
    expect(g2.roundLog[0].caughtTeamId).toBe('blue');
  });

  it('records the caught player when names exist', () => {
    const [g0, deps] = started({ teams: makeTeams(2, true) });
    expect(blow(g0, deps).roundLog[0]).toEqual({ caughtTeamId: 'red', at: deps.time, caughtPlayer: 'red-a' });
  });

  it('is ignored outside playing', () => {
    const deps = makeDeps();
    const g = createGame(makeSettings());
    expect(reduce(g, { type: 'TICK', now: Number.MAX_SAFE_INTEGER }, deps)).toBe(g);
  });
});

describe('SHOW_SCOREBOARD', () => {
  const caughtWith = (scores: Record<string, number>, teams = 2): GameState => ({
    ...createGame(makeSettings({ teams: makeTeams(teams), targetScore: 3 })),
    phase: 'caught',
    scores,
  });

  it('goes to scoreboard below target', () => {
    const g = reduce(caughtWith({ red: 2, blue: 1 }), { type: 'SHOW_SCOREBOARD' }, makeDeps());
    expect(g.phase).toBe('scoreboard');
    expect(g.winnerTeamId).toBeNull();
  });

  it('declares a single leader at target the winner', () => {
    const g = reduce(caughtWith({ red: 3, blue: 1 }), { type: 'SHOW_SCOREBOARD' }, makeDeps());
    expect(g.phase).toBe('won');
    expect(g.winnerTeamId).toBe('red');
  });

  it('continues in sudden death when the top is tied at/above target', () => {
    const tied = reduce(caughtWith({ red: 3, blue: 3, green: 2 }, 3), { type: 'SHOW_SCOREBOARD' }, makeDeps());
    expect(tied.phase).toBe('scoreboard');
    const above = reduce(caughtWith({ red: 4, blue: 3, green: 4 }, 3), { type: 'SHOW_SCOREBOARD' }, makeDeps());
    expect(above.phase).toBe('scoreboard');
    const resolved = reduce(caughtWith({ red: 5, blue: 3, green: 4 }, 3), { type: 'SHOW_SCOREBOARD' }, makeDeps());
    expect(resolved.winnerTeamId).toBe('red');
  });

  it('is ignored outside caught', () => {
    const g = createGame(makeSettings());
    expect(reduce(g, { type: 'SHOW_SCOREBOARD' }, makeDeps())).toBe(g);
  });
});

describe('NEXT_ROUND', () => {
  it('passes the phone one seat on from the last holder and lights a new fuse', () => {
    const [g0, deps] = started({ teams: makeTeams(3, true) });
    deps.advance(1000);
    const g1 = run(g0, deps, { type: 'GOT_IT' }); // red -> blue
    const caught = blow(g1, deps); // blue caught
    const sb = run(caught, deps, { type: 'SHOW_SCOREBOARD' });
    deps.advance(30_000);
    const g2 = run(sb, deps, { type: 'NEXT_ROUND' });
    expect(g2.phase).toBe('playing');
    expect(g2.round).toBe(2);
    expect(g2.holderTeamIndex).toBe(2);
    expect(g2.playerCursor).toEqual({ red: 1, blue: 1, green: 0 });
    expect(g2.fuseEndsAt).toBe(deps.time + (g2.fuseDurationMs as number));
    expect(g2.lastAdvanceAt).toBeNull();
    expect(g2.phraseShownAt).toBe(deps.time);
  });

  it('wraps around and resets skips', () => {
    const [g0, deps] = started({ skipsPerTurn: 1 });
    const s = run(g0, deps, { type: 'SKIP' });
    const g1 = run(s, deps, { type: 'END_ROUND_NO_SCORE' });
    const g2 = run(g1, deps, { type: 'NEXT_ROUND' });
    expect(g2.holderTeamIndex).toBe(1);
    expect(g2.skipsLeft).toBe(1);
    const g3 = run(g2, deps, { type: 'END_ROUND_NO_SCORE' }, { type: 'NEXT_ROUND' });
    expect(g3.holderTeamIndex).toBe(0);
    expect(g3.round).toBe(3);
  });

  it('is ignored outside scoreboard', () => {
    const [g0, deps] = started();
    expect(reduce(g0, { type: 'NEXT_ROUND' }, deps)).toBe(g0);
    const c = blow(g0, deps);
    expect(reduce(c, { type: 'NEXT_ROUND' }, deps)).toBe(c);
  });
});

describe('UNDO_LAST_POINT', () => {
  it('reverts the last caught round and returns to scoreboard', () => {
    const [g0, deps] = started({ teams: makeTeams(3) });
    const c = blow(g0, deps);
    expect(c.scores).toEqual({ red: 0, blue: 1, green: 1 });
    const u = run(c, deps, { type: 'UNDO_LAST_POINT' });
    expect(u.phase).toBe('scoreboard');
    expect(u.scores).toEqual({ red: 0, blue: 0, green: 0 });
    expect(u.roundLog).toEqual([]);
    expect(reduce(u, { type: 'UNDO_LAST_POINT' }, deps)).toBe(u);
  });

  it('undoes a win', () => {
    const [g0, deps] = started({ targetScore: 1 });
    const w = run(blow(g0, deps), deps, { type: 'SHOW_SCOREBOARD' });
    expect(w.phase).toBe('won');
    expect(w.winnerTeamId).toBe('blue');
    const u = run(w, deps, { type: 'UNDO_LAST_POINT' });
    expect(u.phase).toBe('scoreboard');
    expect(u.winnerTeamId).toBeNull();
    expect(u.scores).toEqual({ red: 0, blue: 0 });
  });

  it('never drives a score below zero', () => {
    const g: GameState = {
      ...createGame(makeSettings()),
      phase: 'scoreboard',
      roundLog: [{ caughtTeamId: 'red', at: 1 }],
    };
    expect(reduce(g, { type: 'UNDO_LAST_POINT' }, makeDeps()).scores).toEqual({ red: 0, blue: 0 });
  });

  it('is ignored while playing or in setup', () => {
    const [g0, deps] = started();
    const withLog = { ...g0, roundLog: [{ caughtTeamId: 'red', at: 1 }] };
    expect(reduce(withLog, { type: 'UNDO_LAST_POINT' }, deps)).toBe(withLog);
    const setup = createGame(makeSettings());
    expect(reduce(setup, { type: 'UNDO_LAST_POINT' }, deps)).toBe(setup);
  });
});

describe('END_ROUND_NO_SCORE', () => {
  it('ends a playing round without scoring or logging', () => {
    const [g0, deps] = started();
    const g1 = run(g0, deps, { type: 'END_ROUND_NO_SCORE' });
    expect(g1.phase).toBe('scoreboard');
    expect(g1.scores).toEqual(g0.scores);
    expect(g1.roundLog).toEqual([]);
    expect(g1.fuseEndsAt).toBeNull();
  });

  it('ends a paused round and clears the frozen fuse', () => {
    const [g0, deps] = started();
    const g1 = run(g0, deps, { type: 'PAUSE' }, { type: 'END_ROUND_NO_SCORE' });
    expect(g1.phase).toBe('scoreboard');
    expect(g1.pausedRemainingMs).toBeNull();
  });

  it('is ignored in other phases', () => {
    const [g0, deps] = started();
    const c = blow(g0, deps);
    expect(reduce(c, { type: 'END_ROUND_NO_SCORE' }, deps)).toBe(c);
  });
});

it('returns the same state for an unknown action', () => {
  const g = createGame(makeSettings());
  expect(reduce(g, { type: 'NOPE' } as unknown as Action, makeDeps())).toBe(g);
});
