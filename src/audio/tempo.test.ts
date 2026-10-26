import * as fc from 'fast-check';

import {
  baseIntervalMs,
  clampProgress,
  createTempoCurve,
  NEUTRAL_CURVE,
  nextIntervalMs,
  TEMPO,
  tickStrength,
  type TempoCurve,
} from './tempo';

/** Deterministic PRNG for tests (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const unit = fc.double({ min: 0, max: 1, noNaN: true, maxExcluded: true });
const curveArb = fc.tuple(unit, unit, unit).map(([a, b, c]) => {
  const vals = [a, b, c];
  return createTempoCurve(() => vals.shift() ?? 0);
});

describe('clampProgress', () => {
  it('coerces junk into [0, 1]', () => {
    expect(clampProgress(NaN)).toBe(0);
    expect(clampProgress(-3)).toBe(0);
    expect(clampProgress(4)).toBe(1);
    expect(clampProgress(Infinity)).toBe(0);
    expect(clampProgress(0.4)).toBe(0.4);
  });
});

describe('createTempoCurve', () => {
  it('draws every parameter inside its configured range', () => {
    fc.assert(
      fc.property(curveArb, (c: TempoCurve) => {
        expect(c.exponent).toBeGreaterThanOrEqual(TEMPO.exponentRange[0]);
        expect(c.exponent).toBeLessThanOrEqual(TEMPO.exponentRange[1]);
        expect(c.shift).toBeGreaterThanOrEqual(TEMPO.shiftRange[0]);
        expect(c.shift).toBeLessThanOrEqual(TEMPO.shiftRange[1]);
        expect(c.jitter).toBeGreaterThanOrEqual(0.15);
        expect(c.jitter).toBeLessThanOrEqual(0.25);
      }),
    );
  });

  it('differs between rounds', () => {
    const rng = seeded(7);
    const curves = Array.from({ length: 20 }, () => createTempoCurve(rng));
    expect(new Set(curves.map((c) => c.exponent.toFixed(6))).size).toBe(20);
  });
});

describe('baseIntervalMs', () => {
  it('runs from ~1000 ms down to ~150 ms on the neutral curve', () => {
    expect(baseIntervalMs(0)).toBeCloseTo(TEMPO.slowestMs, 6);
    expect(baseIntervalMs(1)).toBeCloseTo(TEMPO.fastestMs, 6);
  });

  it('is non-increasing in progress for any curve', () => {
    fc.assert(
      fc.property(curveArb, unit, unit, (curve, a, b) => {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        expect(baseIntervalMs(hi, curve)).toBeLessThanOrEqual(baseIntervalMs(lo, curve) + 1e-9);
      }),
    );
  });

  it('accelerates: tempo (ticks/s) rises much faster in the second half of the fuse', () => {
    const tempo = (p: number) => 1000 / baseIntervalMs(p);
    const firstHalf = tempo(0.5) - tempo(0);
    const secondHalf = tempo(1) - tempo(0.5);
    expect(secondHalf).toBeGreaterThan(3 * firstHalf);
  });
});

describe('nextIntervalMs', () => {
  it('always stays within [minMs, maxMs]', () => {
    fc.assert(
      fc.property(curveArb, fc.double({ min: -1, max: 2, noNaN: true }), fc.integer(), (curve, p, seed) => {
        const ms = nextIntervalMs(p, curve, seeded(seed));
        expect(ms).toBeGreaterThanOrEqual(TEMPO.minMs);
        expect(ms).toBeLessThanOrEqual(TEMPO.maxMs);
      }),
    );
  });

  it('stays within the jitter band around the base interval', () => {
    fc.assert(
      fc.property(curveArb, unit, unit, (curve, p, j) => {
        const base = baseIntervalMs(p, curve);
        const ms = nextIntervalMs(p, curve, () => j);
        expect(ms).toBeGreaterThanOrEqual(Math.max(TEMPO.minMs, base * (1 - curve.jitter)) - 1e-9);
        expect(ms).toBeLessThanOrEqual(Math.min(TEMPO.maxMs, base * (1 + curve.jitter)) + 1e-9);
      }),
    );
  });

  it('decreases with progress on average, across random rounds', () => {
    const rng = seeded(42);
    const mean = (p: number) => {
      let sum = 0;
      for (let i = 0; i < 2000; i++) sum += nextIntervalMs(p, createTempoCurve(rng), rng);
      return sum / 2000;
    };
    const means = [0, 0.25, 0.5, 0.75, 0.9, 1].map(mean);
    for (let i = 1; i < means.length; i++) expect(means[i]).toBeLessThan(means[i - 1]);
    expect(means[0]).toBeGreaterThan(850);
    expect(means[means.length - 1]).toBeLessThan(220);
  });

  it('jitters: consecutive intervals at a fixed progress vary', () => {
    const rng = seeded(3);
    const values = Array.from({ length: 200 }, () => nextIntervalMs(0.5, NEUTRAL_CURVE, rng));
    expect(new Set(values.map((v) => v.toFixed(3))).size).toBeGreaterThan(190);
    const base = baseIntervalMs(0.5, NEUTRAL_CURVE);
    const spread = (Math.max(...values) - Math.min(...values)) / base;
    // NEUTRAL jitter is +/-20 %: the observed spread should cover most of the 40 % band.
    expect(spread).toBeGreaterThan(0.3);
    expect(spread).toBeLessThanOrEqual(0.4 + 1e-9);
  });

  it('per-round curves make the same progress sound different between rounds', () => {
    const rng = seeded(11);
    const bases = Array.from({ length: 50 }, () => baseIntervalMs(0.6, createTempoCurve(rng)));
    expect(Math.max(...bases) / Math.min(...bases)).toBeGreaterThan(1.3);
  });
});

describe('tickStrength', () => {
  it('intensifies toward the end', () => {
    expect(tickStrength(0)).toBe('light');
    expect(tickStrength(0.59)).toBe('light');
    expect(tickStrength(0.6)).toBe('medium');
    expect(tickStrength(0.85)).toBe('heavy');
    expect(tickStrength(1)).toBe('heavy');
    expect(tickStrength(NaN)).toBe('light');
  });
});
