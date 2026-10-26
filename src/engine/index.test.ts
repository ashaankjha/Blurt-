import * as engine from './index';
import { createGame, fuseProgress, fuseRemainingMs, holderLabel, mulberry32, reduce } from './index';
import { makeDeps, makeSettings, makeTeams } from './testHelpers';
import type { GameState } from './types';

describe('public API', () => {
  it('keeps the agreed exports', () => {
    for (const name of ['createGame', 'reduce', 'fuseProgress', 'fuseRemainingMs', 'holderLabel', 'mulberry32']) {
      expect(typeof (engine as Record<string, unknown>)[name]).toBe('function');
    }
  });
});

describe('mulberry32', () => {
  it('is deterministic per seed and stays in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const c = mulberry32(43);
    const xs = Array.from({ length: 1000 }, () => a());
    expect(Array.from({ length: 1000 }, () => b())).toEqual(xs);
    expect(c()).not.toBe(xs[0]);
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });
});

describe('fuse helpers', () => {
  const deps = makeDeps();
  deps.rng = () => 0; // fuse = fuseMinMs
  const settings = makeSettings({ fuseMinMs: 10_000, fuseMaxMs: 20_000 });
  const t0 = deps.time;
  const playing = reduce(createGame(settings), { type: 'START_ROUND' }, deps);

  it('is 0 / null in setup and scoreboard', () => {
    const setup = createGame(settings);
    expect(fuseProgress(setup, t0)).toBe(0);
    expect(fuseRemainingMs(setup, t0)).toBeNull();
    const sb = reduce(playing, { type: 'END_ROUND_NO_SCORE' }, deps);
    expect(fuseProgress(sb, t0)).toBe(0);
    expect(fuseRemainingMs(sb, t0)).toBeNull();
  });

  it('tracks elapsed time while playing, clamped to [0, 1]', () => {
    expect(fuseProgress(playing, t0)).toBe(0);
    expect(fuseProgress(playing, t0 + 2500)).toBe(0.25);
    expect(fuseProgress(playing, t0 + 10_000)).toBe(1);
    expect(fuseProgress(playing, t0 + 99_000)).toBe(1);
    expect(fuseProgress(playing, t0 - 5000)).toBe(0);
    expect(fuseRemainingMs(playing, t0 + 2500)).toBe(7500);
    expect(fuseRemainingMs(playing, t0 + 99_000)).toBe(0);
  });

  it('freezes while paused and continues after resume', () => {
    deps.set(t0 + 4000);
    const paused = reduce(playing, { type: 'PAUSE' }, deps);
    expect(fuseProgress(paused, t0 + 4000)).toBeCloseTo(0.4);
    expect(fuseProgress(paused, t0 + 900_000)).toBeCloseTo(0.4);
    expect(fuseRemainingMs(paused, t0 + 900_000)).toBe(6000);
    deps.set(t0 + 100_000);
    const resumed = reduce(paused, { type: 'RESUME' }, deps);
    expect(fuseProgress(resumed, t0 + 100_000)).toBeCloseTo(0.4);
    expect(fuseProgress(resumed, t0 + 103_000)).toBeCloseTo(0.7);
    deps.set(t0);
  });

  it('is 1 once caught', () => {
    const caught = reduce(playing, { type: 'TICK', now: t0 + 10_000 }, deps);
    expect(caught.phase).toBe('caught');
    expect(fuseProgress(caught, t0)).toBe(1);
    expect(fuseRemainingMs(caught, t0)).toBeNull();
  });

  it('returns 0 for inconsistent states instead of NaN', () => {
    const noDuration: GameState = { ...playing, fuseDurationMs: null };
    expect(fuseProgress(noDuration, t0)).toBe(0);
    expect(fuseProgress({ ...noDuration, phase: 'paused', pausedRemainingMs: 5 }, t0)).toBe(0);
    expect(fuseProgress({ ...playing, phase: 'paused', pausedRemainingMs: null }, t0)).toBe(0);
    expect(fuseProgress({ ...playing, fuseEndsAt: null }, t0)).toBe(0);
    expect(fuseRemainingMs({ ...playing, fuseEndsAt: null }, t0)).toBeNull();
  });
});

describe('holderLabel', () => {
  it('uses the team name when no players are entered', () => {
    expect(holderLabel(createGame(makeSettings()))).toBe('Team red');
  });

  it('uses the current player name, cycling through the seat order', () => {
    const deps = makeDeps();
    let g = reduce(createGame(makeSettings({ teams: makeTeams(2, true) })), { type: 'START_ROUND' }, deps);
    const labels: string[] = [];
    for (let i = 0; i < 6; i++) {
      labels.push(holderLabel(g));
      deps.advance(1000);
      g = reduce(g, { type: 'GOT_IT' }, deps);
    }
    expect(labels).toEqual(['red-a', 'blue-a', 'red-b', 'blue-a', 'red-a', 'blue-a']);
  });

  it('returns an empty string for an out-of-range holder', () => {
    expect(holderLabel({ ...createGame(makeSettings()), holderTeamIndex: 9 })).toBe('');
  });
});
