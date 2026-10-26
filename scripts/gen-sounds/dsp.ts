/**
 * Tiny offline DSP toolkit for synthesizing Blurt!'s sounds (mono, float32, SR Hz).
 * Everything is deterministic: randomness comes from seeded PRNGs passed in by the caller.
 */

export const SR = 44100;

export type Buf = Float32Array;
/** A value that may vary over time (seconds since the start of the buffer). */
export type Signal = number | ((t: number) => number);

const TAU = Math.PI * 2;

export const samples = (sec: number) => Math.max(1, Math.round(sec * SR));
export const silence = (sec: number): Buf => new Float32Array(samples(sec));
const at = (s: Signal, t: number) => (typeof s === 'number' ? s : s(t));

/** Note name to frequency, e.g. 'A4' -> 440, 'C#5', 'Bb3'. */
export function note(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  const base = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1] as 'C'];
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  const semis = base + acc + (Number(m[3]) - 4) * 12;
  return 440 * Math.pow(2, semis / 12);
}

/** Seeded PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// ---------------------------------------------------------------- oscillators

export type Shape = 'sine' | 'saw' | 'square' | 'triangle' | 'pulse';

function polyBlep(t: number, dt: number): number {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1;
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
}

/** Band-limited (polyBLEP) oscillator with time-varying frequency and pulse width. */
export function osc(shape: Shape, freq: Signal, sec: number, opts: { phase?: number; pw?: Signal } = {}): Buf {
  const n = samples(sec);
  const out = new Float32Array(n);
  let phase = opts.phase ?? 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = Math.max(0, at(freq, t));
    const dt = Math.min(0.5, f / SR);
    let v: number;
    switch (shape) {
      case 'sine':
        v = Math.sin(TAU * phase);
        break;
      case 'saw':
        v = 2 * phase - 1 - polyBlep(phase, dt);
        break;
      case 'triangle':
        v = 1 - 4 * Math.abs(phase - 0.5);
        break;
      case 'square':
      case 'pulse': {
        const pw = shape === 'square' ? 0.5 : Math.min(0.95, Math.max(0.05, at(opts.pw ?? 0.25, t)));
        v = phase < pw ? 1 : -1;
        v += polyBlep(phase, dt);
        v -= polyBlep((phase + 1 - pw) % 1, dt);
        break;
      }
    }
    out[i] = v;
    phase += dt === 0.5 ? f / SR : dt;
    phase -= Math.floor(phase);
  }
  return out;
}

export function noise(sec: number, r: () => number): Buf {
  const out = silence(sec);
  for (let i = 0; i < out.length; i++) out[i] = r() * 2 - 1;
  return out;
}

/** Sum of partials {ratio, amp, decay(s)} on a base frequency; a quick additive bell/metal voice. */
export function partials(
  base: Signal,
  list: { ratio: number; amp: number; decay: number; attack?: number }[],
  sec: number,
): Buf {
  const out = silence(sec);
  for (const p of list) {
    const tone = osc('sine', typeof base === 'number' ? base * p.ratio : (t) => base(t) * p.ratio, sec, {
      phase: (p.ratio * 0.137) % 1,
    });
    const a = p.attack ?? 0.002;
    for (let i = 0; i < out.length; i++) {
      const t = i / SR;
      const env = Math.min(1, t / a) * Math.exp(-t / p.decay);
      out[i] += tone[i] * p.amp * env;
    }
  }
  return out;
}

/** Karplus-Strong plucked string. */
export function pluck(freq: number, sec: number, r: () => number, damping = 0.996, bright = 0.5): Buf {
  const out = silence(sec);
  const period = Math.max(2, Math.round(SR / freq));
  const line = new Float32Array(period);
  for (let i = 0; i < period; i++) line[i] = r() * 2 - 1;
  let idx = 0;
  for (let i = 0; i < out.length; i++) {
    const cur = line[idx];
    const next = line[(idx + 1) % period];
    out[i] = cur;
    // Averaging is the classic low-pass; `bright` keeps some of the raw sample for a twangier tone.
    line[idx] = damping * (bright * cur + (1 - bright) * 0.5 * (cur + next));
    idx = (idx + 1) % period;
  }
  return out;
}

// ---------------------------------------------------------------- filters

export type FilterType = 'lowpass' | 'highpass' | 'bandpass' | 'peak';

/** RBJ biquad with time-varying cutoff and Q (coefficients updated every 16 samples). */
export function biquad(input: Buf, type: FilterType, cutoff: Signal, q: Signal = 0.707, gainDb = 6): Buf {
  const out = new Float32Array(input.length);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let a1 = 0;
  let a2 = 0;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < input.length; i++) {
    if (i % 16 === 0) {
      const t = i / SR;
      const f = Math.min(SR * 0.45, Math.max(10, at(cutoff, t)));
      const Q = Math.max(0.1, at(q, t));
      const w = (TAU * f) / SR;
      const cos = Math.cos(w);
      const alpha = Math.sin(w) / (2 * Q);
      let a0: number;
      if (type === 'lowpass') {
        b0 = (1 - cos) / 2;
        b1 = 1 - cos;
        b2 = (1 - cos) / 2;
        a0 = 1 + alpha;
        a1 = -2 * cos;
        a2 = 1 - alpha;
      } else if (type === 'highpass') {
        b0 = (1 + cos) / 2;
        b1 = -(1 + cos);
        b2 = (1 + cos) / 2;
        a0 = 1 + alpha;
        a1 = -2 * cos;
        a2 = 1 - alpha;
      } else if (type === 'bandpass') {
        b0 = alpha;
        b1 = 0;
        b2 = -alpha;
        a0 = 1 + alpha;
        a1 = -2 * cos;
        a2 = 1 - alpha;
      } else {
        const A = Math.pow(10, gainDb / 40);
        b0 = 1 + alpha * A;
        b1 = -2 * cos;
        b2 = 1 - alpha * A;
        a0 = 1 + alpha / A;
        a1 = -2 * cos;
        a2 = 1 - alpha / A;
      }
      b0 /= a0;
      b1 /= a0;
      b2 /= a0;
      a1 /= a0;
      a2 /= a0;
    }
    const x = input[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    out[i] = y;
  }
  return out;
}

export const lowpass = (b: Buf, f: Signal, q: Signal = 0.707) => biquad(b, 'lowpass', f, q);
export const highpass = (b: Buf, f: Signal, q: Signal = 0.707) => biquad(b, 'highpass', f, q);
export const bandpass = (b: Buf, f: Signal, q: Signal = 1) => biquad(b, 'bandpass', f, q);

// ---------------------------------------------------------------- envelopes and shaping

/** Multiply by a gain function of time. */
export function shape(input: Buf, gain: (t: number) => number): Buf {
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) out[i] = input[i] * gain(i / SR);
  return out;
}

/** Piecewise-linear envelope from [time, value] points. */
export function env(points: [number, number][]): (t: number) => number {
  return (t) => {
    if (t <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i++) {
      const [t1, v1] = points[i];
      if (t <= t1) {
        const [t0, v0] = points[i - 1];
        return v0 + ((v1 - v0) * (t - t0)) / Math.max(1e-9, t1 - t0);
      }
    }
    return points[points.length - 1][1];
  };
}

/** Attack / hold / release gate for a note of `sec` seconds. */
export function gate(sec: number, attack = 0.01, release = 0.05): (t: number) => number {
  return (t) => Math.max(0, Math.min(1, t / attack, (sec - t) / release));
}

export const expDecay =
  (tau: number, attack = 0.001) =>
  (t: number) =>
    Math.min(1, t / attack) * Math.exp(-t / tau);

/** Exponential glide from a to b over `sec` (then holds b). */
export const glide = (a: number, b: number, sec: number) => (t: number) => a * Math.pow(b / a, Math.min(1, t / sec));

/** Symmetric soft clip, normalized so drive doesn't change full-scale peaks. */
export function drive(input: Buf, amount: number): Buf {
  const out = new Float32Array(input.length);
  const k = Math.tanh(amount);
  for (let i = 0; i < input.length; i++) out[i] = Math.tanh(input[i] * amount) / k;
  return out;
}

/** Reduce bit depth and sample rate for an 8-bit feel. */
export function crush(input: Buf, bits: number, holdSamples: number): Buf {
  const out = new Float32Array(input.length);
  const steps = Math.pow(2, bits - 1);
  let held = 0;
  for (let i = 0; i < input.length; i++) {
    if (i % holdSamples === 0) held = Math.round(input[i] * steps) / steps;
    out[i] = held;
  }
  return out;
}

export function ringMod(input: Buf, freq: Signal, depth = 1): Buf {
  const carrier = osc('sine', freq, input.length / SR);
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) out[i] = input[i] * (1 - depth + depth * carrier[i]);
  return out;
}

/** Feedback echo. */
export function echo(input: Buf, delaySec: number, feedback: number, wet: number, tailSec = 0): Buf {
  const out = new Float32Array(input.length + samples(tailSec));
  const d = samples(delaySec);
  const line = new Float32Array(out.length);
  for (let i = 0; i < out.length; i++) {
    const dry = i < input.length ? input[i] : 0;
    const delayed = i >= d ? line[i - d] : 0;
    line[i] = dry + delayed * feedback;
    out[i] = dry + delayed * wet;
  }
  return out;
}

/** Small Schroeder reverb (4 combs + 2 allpasses). */
export function reverb(input: Buf, size = 0.5, wet = 0.25, tailSec = 0.5): Buf {
  const n = input.length + samples(tailSec);
  const src = new Float32Array(n);
  src.set(input);
  const combs = [1116, 1188, 1277, 1356].map((l) => Math.round(l * (0.6 + size * 0.8)));
  const fb = 0.7 + size * 0.25;
  const wetBuf = new Float32Array(n);
  for (const len of combs) {
    const line = new Float32Array(len);
    let idx = 0;
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const y = line[idx];
      lp = y * 0.8 + lp * 0.2;
      line[idx] = src[i] + lp * fb;
      wetBuf[i] += y / combs.length;
      idx = (idx + 1) % len;
    }
  }
  for (const len of [556, 441]) {
    const line = new Float32Array(len);
    let idx = 0;
    for (let i = 0; i < n; i++) {
      const buf = line[idx];
      const y = -wetBuf[i] + buf;
      line[idx] = wetBuf[i] + buf * 0.5;
      wetBuf[i] = y;
      idx = (idx + 1) % len;
    }
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = src[i] + wetBuf[i] * wet;
  return out;
}

/** Read `input` at a time-varying playback rate (vinyl/tape effects). Rate may go negative. */
export function varispeed(input: Buf, rate: (t: number) => number, sec: number, start = 0): Buf {
  const out = silence(sec);
  let pos = start * SR;
  for (let i = 0; i < out.length; i++) {
    const p = Math.max(0, Math.min(input.length - 2, pos));
    const i0 = Math.floor(p);
    const frac = p - i0;
    out[i] = input[i0] * (1 - frac) + input[i0 + 1] * frac;
    pos += rate(i / SR);
  }
  return out;
}

// ---------------------------------------------------------------- mixing

export function gain(input: Buf, g: number): Buf {
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) out[i] = input[i] * g;
  return out;
}

/** Sum buffers (result is as long as the longest). */
export function mix(...parts: (Buf | [Buf, number])[]): Buf {
  const list = parts.map((p) => (Array.isArray(p) ? p : ([p, 1] as [Buf, number])));
  const out = new Float32Array(Math.max(...list.map(([b]) => b.length)));
  for (const [b, g] of list) for (let i = 0; i < b.length; i++) out[i] += b[i] * g;
  return out;
}

/** Place clips on a timeline: [clip, startSec, gain?]. */
export function sequence(sec: number, events: [Buf, number, number?][]): Buf {
  const out = silence(sec);
  for (const [clip, start, g = 1] of events) {
    const offset = samples(start);
    for (let i = 0; i < clip.length && offset + i < out.length; i++) out[offset + i] += clip[i] * g;
  }
  return out;
}

export function concat(...parts: Buf[]): Buf {
  const out = new Float32Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export function peak(b: Buf): number {
  let m = 0;
  for (let i = 0; i < b.length; i++) m = Math.max(m, Math.abs(b[i]));
  return m;
}

export function rms(b: Buf): number {
  let s = 0;
  for (let i = 0; i < b.length; i++) s += b[i] * b[i];
  return Math.sqrt(s / Math.max(1, b.length));
}

/**
 * Final mastering: DC block, short fades, optional loudness drive, trim trailing silence,
 * then peak-normalize to `peakTarget` (linear). Guarantees no clipping.
 */
export function master(input: Buf, opts: { peakTarget: number; loudness?: number; fadeOut?: number }): Buf {
  let b = highpass(input, 35, 0.707);
  const pk = peak(b);
  if (!(pk > 0) || !Number.isFinite(pk)) throw new Error('silent or non-finite buffer');
  b = gain(b, 1 / pk);
  if (opts.loudness && opts.loudness > 0) b = drive(b, opts.loudness);
  // Trim trailing near-silence (below -60 dB of peak) but keep a short tail.
  const floor = peak(b) * 0.001;
  let end = b.length;
  while (end > 1 && Math.abs(b[end - 1]) < floor) end--;
  b = b.slice(0, Math.min(b.length, end + samples(0.01)));
  const fadeIn = samples(0.0015);
  const fadeOut = Math.min(b.length, samples(opts.fadeOut ?? 0.02));
  for (let i = 0; i < fadeIn && i < b.length; i++) b[i] *= i / fadeIn;
  for (let i = 0; i < fadeOut; i++) b[b.length - 1 - i] *= i / fadeOut;
  const p2 = peak(b);
  return gain(b, opts.peakTarget / p2);
}
