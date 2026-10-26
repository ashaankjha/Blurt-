/** Pure confetti particle generation and motion (no React), shared with the worklet. */

export interface Particle {
  /** Start position (px), relative to the overlay's top-left. */
  x0: number;
  y0: number;
  /** Initial velocity (px/s). */
  vx: number;
  vy: number;
  /** Rotation start (deg) and speed (deg/s). */
  r0: number;
  vr: number;
  /** Side-to-side flutter amplitude (px) and frequency (rad/s). */
  sway: number;
  freq: number;
  w: number;
  h: number;
  color: string;
  /** Round dot instead of a strip. */
  round: boolean;
}

/** Mulberry32: tiny seeded RNG so bursts are reproducible in tests. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Gravity as a multiple of the overlay height per s^2. */
export const GRAVITY = 2.4;

export function makeParticles(
  count: number,
  width: number,
  height: number,
  colors: readonly string[],
  rng: () => number = Math.random,
): Particle[] {
  const out: Particle[] = [];
  const palette = colors.length ? colors : ['#FFFFFF'];
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (rng() - 0.5) * (Math.PI * 0.9); // mostly upward fan
    const speed = height * (0.9 + rng() * 0.7);
    const size = 8 + rng() * 8;
    const round = rng() < 0.25;
    out.push({
      x0: width / 2 + (rng() - 0.5) * width * 0.2,
      y0: height * 0.45,
      vx: Math.cos(angle) * speed * 0.6,
      vy: Math.sin(angle) * speed,
      r0: rng() * 360,
      vr: (rng() - 0.5) * 720,
      sway: 6 + rng() * 14,
      freq: 4 + rng() * 6,
      w: round ? size : size * 0.55,
      h: size,
      color: palette[i % palette.length],
      round,
    });
  }
  return out;
}

/** Particle position at time t (s). Marked as a worklet so it can run on the UI thread. */
export function particleAt(p: Particle, t: number, height: number): { x: number; y: number; r: number } {
  'worklet';
  return {
    x: p.x0 + p.vx * t + p.sway * Math.sin(p.freq * t),
    y: p.y0 + p.vy * t + 0.5 * GRAVITY * height * t * t,
    r: p.r0 + p.vr * t,
  };
}
