/** Pure number helpers for Stepper and RangeSlider (no React). */

const decimals = (n: number) => {
  const s = String(n);
  const i = s.indexOf('.');
  return i === -1 ? 0 : s.length - i - 1;
};

/** Rounds away float noise to the precision of `step` (0.1 + 0.2 -> 0.3). */
function tidy(v: number, step: number): number {
  const d = Math.min(10, decimals(step));
  return Number(v.toFixed(d));
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Snaps `v` to the nearest `min + k * step`, clamped to [min, max]. */
export function snap(v: number, min: number, max: number, step: number): number {
  if (!(step > 0)) return clamp(v, min, max);
  const k = Math.round((v - min) / step);
  return tidy(clamp(min + k * step, min, max), step);
}

/** value + delta, clamped (used by the Stepper buttons and accessibility actions). */
export function stepValue(value: number, delta: number, min: number, max: number, step = Math.abs(delta)): number {
  return tidy(clamp(value + delta, min, max), step || 1);
}

/** Position of `v` in [min, max] as 0..1. */
export function toFraction(v: number, min: number, max: number): number {
  return max === min ? 0 : clamp((v - min) / (max - min), 0, 1);
}

/** Value at fraction `f` (0..1), snapped to step. */
export function fromFraction(f: number, min: number, max: number, step: number): number {
  return snap(min + clamp(f, 0, 1) * (max - min), min, max, step);
}

export type Thumb = 'low' | 'high';

/**
 * Moves one thumb to `v` (snapped). Thumbs never cross: low <= high always holds (they may
 * meet). Returns the new [low, high].
 */
export function moveThumb(
  thumb: Thumb,
  v: number,
  low: number,
  high: number,
  min: number,
  max: number,
  step: number,
): [number, number] {
  const s = snap(v, min, max, step);
  if (thumb === 'low') return [Math.min(s, high), high];
  return [low, Math.max(s, low)];
}

/** Which thumb a touch at value `v` should grab: the nearer one (ties: the one that can move). */
export function nearestThumb(v: number, low: number, high: number): Thumb {
  if (low === high) return v < low ? 'low' : 'high';
  return Math.abs(v - low) <= Math.abs(v - high) ? 'low' : 'high';
}
