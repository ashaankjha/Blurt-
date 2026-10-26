/**
 * Test-only helpers for engine tests (not exported from index.ts).
 */
import { mulberry32 } from './rng';
import type { EngineDeps, GameSettings, Phrase, Team } from './types';

export const TEAM_IDS = ['red', 'blue', 'green', 'gold'] as const;

export function makeTeams(count: number, withPlayers = false): Team[] {
  return TEAM_IDS.slice(0, count).map((id, i) => ({
    id,
    name: `Team ${id}`,
    color: '#000000',
    players: withPlayers ? [`${id}-a`, `${id}-b`].slice(0, i % 2 === 0 ? 2 : 1) : [],
  }));
}

export function makeSettings(overrides: Partial<GameSettings> = {}): GameSettings {
  return {
    mode: 'classic',
    teams: makeTeams(2),
    packIds: ['test'],
    targetScore: 7,
    skipsPerTurn: 3,
    fuseMinMs: 45_000,
    fuseMaxMs: 75_000,
    showFuse: false,
    ...overrides,
  };
}

/** Controllable deps: a settable clock, seeded rng, and a counting phrase drawer. */
export interface TestDeps extends EngineDeps {
  time: number;
  draws: number;
  set(t: number): void;
  advance(ms: number): void;
}

export function makeDeps(seed = 1, start = 1_000_000): TestDeps {
  const rng = mulberry32(seed);
  const deps: TestDeps = {
    time: start,
    draws: 0,
    now: () => deps.time,
    rng,
    draw: (): Phrase => {
      deps.draws += 1;
      return { id: `test:p${deps.draws}`, text: `Phrase ${deps.draws}`, difficulty: 1 };
    },
    set: (t) => {
      deps.time = t;
    },
    advance: (ms) => {
      deps.time += ms;
    },
  };
  return deps;
}

/** Recursively freezes an object so any mutation by the reducer throws in strict mode. */
export function deepFreeze<T>(obj: T): T {
  if (obj !== null && typeof obj === 'object') {
    Object.freeze(obj);
    for (const v of Object.values(obj as Record<string, unknown>)) deepFreeze(v);
  }
  return obj;
}
