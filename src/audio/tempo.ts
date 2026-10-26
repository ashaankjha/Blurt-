/**
 * Pure fuse-tick tempo math (no React/Expo). RNG is injected so it is deterministic in tests.
 *
 * The interval shrinks from ~1000 ms to ~150 ms along an accelerating (geometric, eased-in)
 * curve. Two layers of randomness keep the remaining fuse time from being read off the tempo:
 * - a per-round curve (random easing exponent and progress offset), and
 * - per-tick jitter of +/- 15-25 % (the jitter depth itself is also drawn per round).
 */

export const TEMPO = {
  /** Base interval at progress 0. */
  slowestMs: 1000,
  /** Base interval at progress 1. */
  fastestMs: 150,
  /** Hard clamp applied after jitter. */
  minMs: 110,
  maxMs: 1300,
  /** Per-round easing exponent: >1 keeps the start slow and makes the end rush. */
  exponentRange: [1.3, 2.1] as const,
  /** Per-round shift added to progress before shaping. */
  shiftRange: [-0.07, 0.07] as const,
  /** Per-round jitter depth (fraction of the interval). */
  jitterRange: [0.15, 0.25] as const,
} as const;

export interface TempoCurve {
  exponent: number;
  shift: number;
  jitter: number;
}

/** A curve with no per-round randomness (midpoint values). */
export const NEUTRAL_CURVE: TempoCurve = {
  exponent: (TEMPO.exponentRange[0] + TEMPO.exponentRange[1]) / 2,
  shift: 0,
  jitter: (TEMPO.jitterRange[0] + TEMPO.jitterRange[1]) / 2,
};

const lerp = ([a, b]: readonly [number, number], t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Coerce any input (NaN, out of range) to a progress value in [0, 1]. */
export function clampProgress(progress: number): number {
  return Number.isFinite(progress) ? clamp(progress, 0, 1) : 0;
}

/** Draw the per-round curve. */
export function createTempoCurve(rng: () => number): TempoCurve {
  return {
    exponent: lerp(TEMPO.exponentRange, rng()),
    shift: lerp(TEMPO.shiftRange, rng()),
    jitter: lerp(TEMPO.jitterRange, rng()),
  };
}

/** Interval before jitter. Monotonically non-increasing in progress for any curve. */
export function baseIntervalMs(progress: number, curve: TempoCurve = NEUTRAL_CURVE): number {
  const p = clamp(clampProgress(progress) + curve.shift, 0, 1);
  const eased = Math.pow(p, curve.exponent);
  return TEMPO.slowestMs * Math.pow(TEMPO.fastestMs / TEMPO.slowestMs, eased);
}

/** Interval until the next tick: base interval with uniform jitter, clamped to [minMs, maxMs]. */
export function nextIntervalMs(progress: number, curve: TempoCurve, rng: () => number): number {
  const jitter = (rng() * 2 - 1) * curve.jitter;
  return clamp(baseIntervalMs(progress, curve) * (1 + jitter), TEMPO.minMs, TEMPO.maxMs);
}

export type TickStrength = 'light' | 'medium' | 'heavy';

/** Haptic strength for a tick: intensifies toward the end of the fuse. */
export function tickStrength(progress: number): TickStrength {
  const p = clampProgress(progress);
  if (p >= 0.85) return 'heavy';
  if (p >= 0.6) return 'medium';
  return 'light';
}
