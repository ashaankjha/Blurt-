/**
 * Property tests (fast-check) for the engine's PRD acceptance criteria:
 * scoring invariant, no double-advance, fuse range, exact target win + undo, immutability.
 */
import * as fc from 'fast-check';

import { LIMITS } from '../config';
import { createGame, reduce } from './rules';
import { mulberry32 } from './rng';
import { deepFreeze, makeDeps, makeSettings, makeTeams, type TestDeps } from './testHelpers';
import type { Action, GameSettings, GameState } from './types';

const D = LIMITS.advanceDebounceMs;

type Kind = Exclude<Action['type'], 'TICK'> | 'TICK';
const KINDS: Kind[] = [
  'START_ROUND',
  'GOT_IT',
  'SKIP',
  'PAUSE',
  'RESUME',
  'TICK',
  'UNDO_LAST_POINT',
  'NEXT_ROUND',
  'END_ROUND_NO_SCORE',
  'SHOW_SCOREBOARD',
];

interface Step {
  kind: Kind;
  dt: number;
}

const stepArb: fc.Arbitrary<Step> = fc.record({
  // TICK is weighted up so fuses actually blow inside random sequences.
  kind: fc.oneof(
    { arbitrary: fc.constantFrom(...KINDS), weight: 3 },
    { arbitrary: fc.constant<Kind>('TICK'), weight: 2 },
  ),
  dt: fc.oneof(fc.integer({ min: 0, max: 400 }), fc.integer({ min: 0, max: 5000 })),
});

const toAction = (kind: Kind, now: number): Action => (kind === 'TICK' ? { type: 'TICK', now } : { type: kind });

/** Short fuses so random sequences cover caught/scoreboard/won paths. */
const quickSettings = (teams: number, extra: Partial<GameSettings> = {}): GameSettings =>
  makeSettings({
    teams: makeTeams(teams, teams % 2 === 1),
    fuseMinMs: 1000,
    fuseMaxMs: 4000,
    targetScore: 4,
    ...extra,
  });

const sum = (rec: Record<string, number>): number => Object.values(rec).reduce((a, b) => a + b, 0);

describe('property: scoring invariant', () => {
  it.each([2, 3, 4])('sum(scores) == roundLog.length * (teams - 1), never negative (%i teams)', (n) => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.array(stepArb, { maxLength: 150 }),
        fc.constantFrom<number | null>(0, 1, 3, null),
        (seed, steps, skips) => {
          const deps = makeDeps(seed);
          let s = createGame(quickSettings(n, { skipsPerTurn: skips }));
          for (const { kind, dt } of steps) {
            deps.advance(dt);
            s = reduce(s, toAction(kind, deps.time), deps);
            expect(sum(s.scores)).toBe(s.roundLog.length * (n - 1));
            for (const v of Object.values(s.scores)) expect(v).toBeGreaterThanOrEqual(0);
            expect(Object.keys(s.scores).sort()).toEqual(
              makeTeams(n)
                .map((t) => t.id)
                .sort(),
            );
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe('property: no double-advance', () => {
  it('GOT_IT/SKIP bursts within 300 ms of an accepted advance advance only once', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.constantFrom<'GOT_IT' | 'SKIP'>('GOT_IT', 'SKIP'),
        fc.array(
          fc.record({
            kind: fc.constantFrom<'GOT_IT' | 'SKIP'>('GOT_IT', 'SKIP'),
            offset: fc.integer({ min: 0, max: D - 1 }),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        fc.integer({ min: 0, max: 20_000 }),
        (seed, first, burst, delay) => {
          const deps = makeDeps(seed);
          const start = reduce(
            createGame(makeSettings({ teams: makeTeams(3), skipsPerTurn: null })),
            { type: 'START_ROUND' },
            deps,
          );
          deps.advance(delay);
          const t = deps.time;
          const accepted = reduce(start, { type: first }, deps);
          expect(accepted).not.toBe(start);
          const drawsAfterFirst = deps.draws;

          const offsets = burst.map((b) => b.offset).sort((a, b) => a - b);
          let s = accepted;
          offsets.forEach((offset, i) => {
            deps.set(t + offset);
            s = reduce(s, { type: burst[i].kind }, deps);
          });
          expect(s).toBe(accepted);
          expect(deps.draws).toBe(drawsAfterFirst);

          // The window is exactly 300 ms: the next advance at t + 300 is accepted.
          deps.set(t + D);
          expect(reduce(s, { type: 'GOT_IT' }, deps)).not.toBe(s);
        },
      ),
      { numRuns: 500 },
    );
  });
});

describe('property: fuse duration', () => {
  const durationFor = (settings: GameSettings, seed: number): number => {
    const deps = makeDeps(seed);
    const s = reduce(createGame(settings), { type: 'START_ROUND' }, deps);
    expect(s.fuseEndsAt).toBe(deps.time + (s.fuseDurationMs as number));
    return s.fuseDurationMs as number;
  };

  it('falls within [min, max] and varies over 10,000 seeded runs (PRD acceptance)', () => {
    const settings = makeSettings(); // 45 000 - 75 000 ms defaults
    const seen = new Set<number>();
    let lo = Infinity;
    let hi = -Infinity;
    for (let seed = 0; seed < 10_000; seed++) {
      const d = durationFor(settings, seed);
      expect(Number.isInteger(d)).toBe(true);
      expect(d).toBeGreaterThanOrEqual(settings.fuseMinMs);
      expect(d).toBeLessThanOrEqual(settings.fuseMaxMs);
      seen.add(d);
      lo = Math.min(lo, d);
      hi = Math.max(hi, d);
    }
    expect(seen.size).toBeGreaterThan(5000);
    // Spread covers the range rather than clustering.
    expect(lo).toBeLessThan(settings.fuseMinMs + 100);
    expect(hi).toBeGreaterThan(settings.fuseMaxMs - 100);
  });

  it('varies between consecutive rounds of one game', () => {
    const deps = makeDeps(7);
    let s = reduce(createGame(makeSettings()), { type: 'START_ROUND' }, deps);
    const durations = [s.fuseDurationMs];
    for (let i = 0; i < 50; i++) {
      s = reduce(reduce(s, { type: 'END_ROUND_NO_SCORE' }, deps), { type: 'NEXT_ROUND' }, deps);
      durations.push(s.fuseDurationMs);
    }
    expect(new Set(durations).size).toBeGreaterThan(45);
  });

  it('holds for any configured range', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: LIMITS.fuseFloorMs, max: LIMITS.fuseCeilMs }),
        fc.integer({ min: 0, max: LIMITS.fuseCeilMs - LIMITS.fuseFloorMs }),
        fc.integer(),
        (min, span, seed) => {
          const max = Math.min(LIMITS.fuseCeilMs, min + span);
          const d = durationFor(makeSettings({ fuseMinMs: min, fuseMaxMs: max }), seed);
          expect(Number.isInteger(d)).toBe(true);
          expect(d).toBeGreaterThanOrEqual(min);
          expect(d).toBeLessThanOrEqual(max);
        },
      ),
      { numRuns: 1000 },
    );
  });
});

/**
 * Seeded "players": pick a plausible action for the current phase, sometimes a random one.
 * Returns every intermediate state so properties can inspect the whole game.
 */
function playGame(seed: number, settings: GameSettings, maxSteps: number): { states: GameState[]; actions: Action[] } {
  const pick = mulberry32(seed ^ 0x9e3779b9);
  const deps: TestDeps = makeDeps(seed);
  let s = createGame(settings);
  const states = [s];
  const actions: Action[] = [];
  const choose = <T>(xs: T[]): T => xs[Math.floor(pick() * xs.length)];
  for (let i = 0; i < maxSteps; i++) {
    deps.advance(Math.floor(pick() * 3000));
    let kind: Kind;
    if (pick() < 0.1) kind = choose(KINDS);
    else
      switch (s.phase) {
        case 'setup':
          kind = 'START_ROUND';
          break;
        case 'playing':
          kind = choose<Kind>(['GOT_IT', 'GOT_IT', 'SKIP', 'TICK', 'TICK', 'TICK', 'PAUSE', 'END_ROUND_NO_SCORE']);
          break;
        case 'paused':
          kind = choose<Kind>(['RESUME', 'RESUME', 'END_ROUND_NO_SCORE']);
          break;
        case 'caught':
          kind = choose<Kind>(['SHOW_SCOREBOARD', 'SHOW_SCOREBOARD', 'SHOW_SCOREBOARD', 'UNDO_LAST_POINT']);
          break;
        case 'scoreboard':
          kind = choose<Kind>(['NEXT_ROUND', 'NEXT_ROUND', 'NEXT_ROUND', 'UNDO_LAST_POINT']);
          break;
        case 'won':
          kind = choose<Kind>(['UNDO_LAST_POINT', 'START_ROUND']);
          break;
      }
    const action = toAction(kind, deps.time);
    s = reduce(s, action, deps);
    actions.push(action);
    states.push(s);
  }
  return { states, actions };
}

describe('property: game ends exactly at target; undo restores prior scores', () => {
  it('2 teams: the first won state has the winner exactly at targetScore', () => {
    let wins = 0;
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 1, max: 10 }), (seed, target) => {
        const { states } = playGame(seed, quickSettings(2, { targetScore: target }), 600);
        const firstWon = states.find((st) => st.phase === 'won');
        if (firstWon) {
          wins++;
          expect(firstWon.winnerTeamId).not.toBeNull();
          expect(firstWon.scores[firstWon.winnerTeamId as string]).toBe(target);
          const others = Object.entries(firstWon.scores).filter(([id]) => id !== firstWon.winnerTeamId);
          for (const [, v] of others) expect(v).toBeLessThan(target);
        }
        // Never 'won' unless a single team leads at/above target.
        for (const st of states) {
          if (st.phase !== 'won') continue;
          const top = Math.max(...Object.values(st.scores));
          expect(st.scores[st.winnerTeamId as string]).toBe(top);
          expect(top).toBeGreaterThanOrEqual(target);
          expect(Object.values(st.scores).filter((v) => v === top)).toHaveLength(1);
        }
      }),
      { numRuns: 300 },
    );
    expect(wins).toBeGreaterThan(100);
  });

  it.each([2, 3, 4])('undo restores the scores from before the undone catch (%i teams)', (n) => {
    let undos = 0;
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const { states, actions } = playGame(seed, quickSettings(n), 400);
        const before: Record<string, number>[] = [];
        for (let i = 1; i < states.length; i++) {
          const prev = states[i - 1];
          const cur = states[i];
          if (cur.roundLog.length === prev.roundLog.length + 1) {
            before.push(prev.scores);
          } else if (cur.roundLog.length === prev.roundLog.length - 1) {
            expect(actions[i - 1].type).toBe('UNDO_LAST_POINT');
            expect(cur.scores).toEqual(before.pop());
            expect(cur.phase).toBe('scoreboard');
            expect(cur.winnerTeamId).toBeNull();
            undos++;
          }
        }
      }),
      { numRuns: 200 },
    );
    expect(undos).toBeGreaterThan(50);
  });
});

describe('property: reducer never mutates its input', () => {
  it('deep-frozen inputs survive any action sequence unchanged', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer({ min: 2, max: 4 }),
        fc.array(stepArb, { maxLength: 120 }),
        (seed, n, steps) => {
          const deps = makeDeps(seed);
          let s = deepFreeze(createGame(quickSettings(n)));
          for (const { kind, dt } of steps) {
            deps.advance(dt);
            const snapshot = structuredClone(s);
            const next = reduce(s, toAction(kind, deps.time), deps); // throws on mutation
            expect(s).toEqual(snapshot);
            s = deepFreeze(next);
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});
