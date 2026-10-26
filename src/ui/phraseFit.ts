/**
 * Pure phrase auto-fit math for PhraseText (no React). Picks the largest font size, between
 * fontSizes.phraseMin and phraseMax, at which the phrase wraps (on word boundaries) into the
 * available box. Widths come from Baloo 2 ExtraBold's real advance widths, so the result can
 * be computed synchronously from a layout size: no measure-and-rerender pass, no flicker.
 */
import { fontSizes, phraseLineHeight } from './tokens';

/**
 * Advance widths (em) of printable ASCII in Baloo2_800ExtraBold, read from the font's hmtx
 * table (unitsPerEm 1000). Regenerate if the phrase font changes.
 */
export const BALOO_EXTRABOLD_ADVANCE: Readonly<Record<string, number>> = {
  ' ': 0.2,
  '!': 0.298,
  '"': 0.41,
  '#': 0.714,
  $: 0.565,
  '%': 0.799,
  '&': 0.673,
  "'": 0.219,
  '(': 0.305,
  ')': 0.305,
  '*': 0.351,
  '+': 0.545,
  ',': 0.243,
  '-': 0.354,
  '.': 0.238,
  '/': 0.343,
  '0': 0.606,
  '1': 0.393,
  '2': 0.522,
  '3': 0.518,
  '4': 0.602,
  '5': 0.522,
  '6': 0.558,
  '7': 0.482,
  '8': 0.56,
  '9': 0.558,
  ':': 0.258,
  ';': 0.266,
  '<': 0.49,
  '=': 0.509,
  '>': 0.491,
  '?': 0.498,
  '@': 1.069,
  A: 0.627,
  B: 0.619,
  C: 0.571,
  D: 0.666,
  E: 0.548,
  F: 0.531,
  G: 0.664,
  H: 0.672,
  I: 0.305,
  J: 0.412,
  K: 0.615,
  L: 0.513,
  M: 0.797,
  N: 0.679,
  O: 0.703,
  P: 0.581,
  Q: 0.705,
  R: 0.609,
  S: 0.551,
  T: 0.556,
  U: 0.664,
  V: 0.634,
  W: 0.863,
  X: 0.601,
  Y: 0.574,
  Z: 0.56,
  '[': 0.303,
  '\\': 0.36,
  ']': 0.317,
  '^': 0.488,
  _: 0.509,
  '`': 0.302,
  a: 0.544,
  b: 0.59,
  c: 0.489,
  d: 0.586,
  e: 0.549,
  f: 0.43,
  g: 0.565,
  h: 0.585,
  i: 0.282,
  j: 0.287,
  k: 0.555,
  l: 0.284,
  m: 0.847,
  n: 0.583,
  o: 0.586,
  p: 0.585,
  q: 0.587,
  r: 0.411,
  s: 0.492,
  t: 0.397,
  u: 0.582,
  v: 0.545,
  w: 0.791,
  x: 0.523,
  y: 0.551,
  z: 0.481,
  '{': 0.337,
  '|': 0.281,
  '}': 0.337,
  '~': 0.503,
};

/** Width used for characters missing from the table (accented letters, curly quotes...). */
const FALLBACK_EM = 0.62;
/** Emoji and other astral-plane symbols. */
const WIDE_EM = 1.2;

export type Measure = (text: string, fontSize: number) => number;

/** Estimated rendered width of `text` at `fontSize` in Baloo 2 ExtraBold. */
export const measureBaloo: Measure = (text, fontSize) => {
  let em = 0;
  for (const ch of text) {
    const w = BALOO_EXTRABOLD_ADVANCE[ch];
    if (w !== undefined) em += w;
    else if (ch.codePointAt(0)! > 0xffff) em += WIDE_EM;
    else em += FALLBACK_EM;
  }
  return em * fontSize;
};

/** Splits on whitespace; collapses runs. */
export function splitWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

/** Greedy word wrap, the same strategy the platform text engines use for plain text. */
export function wrapWords(words: string[], fontSize: number, maxWidth: number, measure: Measure = measureBaloo) {
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (!line || measure(candidate, fontSize) <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export interface FitOptions {
  /** Available width in px. */
  width: number;
  /** Available height in px (omit for width-only fitting). */
  height?: number;
  /** Default fontSizes.phraseMin (40). Never goes below this. */
  min?: number;
  /** Default fontSizes.phraseMax. */
  max?: number;
  /** Line height as a multiple of font size. */
  lineHeight?: number;
  /** Fraction of the width actually used, as headroom for estimate error. Default 0.92. */
  fill?: number;
  measure?: Measure;
}

export interface FitResult {
  fontSize: number;
  lineHeight: number;
  /** Predicted lines (for tests / numberOfLines hints). */
  lines: string[];
  /** True when even the minimum size can't fit (a word is wider than the box, or too tall). */
  overflow: boolean;
}

/**
 * Largest integer font size in [min, max] at which every word fits the width and the wrapped
 * lines fit the height. Fitting is monotonic in font size, so this binary-searches.
 */
export function fitPhrase(text: string, opts: FitOptions): FitResult {
  const min = Math.max(1, Math.floor(opts.min ?? fontSizes.phraseMin));
  const max = Math.max(min, Math.floor(opts.max ?? fontSizes.phraseMax));
  const lh = opts.lineHeight ?? phraseLineHeight;
  const measure = opts.measure ?? measureBaloo;
  const width = Math.max(0, opts.width * (opts.fill ?? 0.92));
  const height = opts.height;
  const words = splitWords(text);

  const layout = (size: number) => {
    const lines = wrapWords(words, size, width, measure);
    const widest = words.reduce((m, w) => Math.max(m, measure(w, size)), 0);
    const fitsWidth = widest <= width;
    const fitsHeight = height === undefined || lines.length * size * lh <= height;
    return { lines, ok: fitsWidth && fitsHeight };
  };

  if (words.length === 0 || width <= 0) {
    return {
      fontSize: min,
      lineHeight: Math.round(min * lh),
      lines: words.length ? [words.join(' ')] : [],
      overflow: words.length > 0,
    };
  }

  let lo = min;
  let hi = max;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (layout(mid).ok) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  const size = best === -1 ? min : best;
  return { fontSize: size, lineHeight: Math.round(size * lh), lines: layout(size).lines, overflow: best === -1 };
}
