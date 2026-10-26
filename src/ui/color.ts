/**
 * Pure color helpers (no React). WCAG 2.x contrast, readable-text picking, shading and a
 * color-vision-deficiency simulation used to verify the team palette stays distinguishable.
 */

export type RGB = [number, number, number];

/** Parses #RGB or #RRGGBB (alpha suffix ignored). */
export function hexToRgb(hex: string): RGB {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3 || h.length === 4) {
    h = h
      .slice(0, 3)
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

export function rgbToHex([r, g, b]: RGB): string {
  return `#${[r, g, b]
    .map((c) => clamp255(c).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

const toLinear = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const toSrgb = (l: number) => {
  const v = l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055;
  return clamp255(v * 255);
};

/** WCAG relative luminance, 0..1. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1..21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** WCAG AA thresholds. */
export const AA_BODY = 4.5;
export const AA_LARGE = 3;

export const INK = '#1B1530';
export const WHITE = '#FFFFFF';

/** Picks whichever of the candidates contrasts best with `bg` (default: white vs ink). */
export function readableTextOn(bg: string, candidates: readonly string[] = [WHITE, INK]): string {
  let best = candidates[0];
  let bestRatio = -1;
  for (const c of candidates) {
    const r = contrastRatio(c, bg);
    if (r > bestRatio) {
      best = c;
      bestRatio = r;
    }
  }
  return best;
}

/** Mixes `hex` toward `target` by `amount` (0..1) in sRGB. */
export function mix(hex: string, target: string, amount: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  const t = Math.max(0, Math.min(1, amount));
  return rgbToHex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
}

/** Darker shade, e.g. for the solid "chunky" block under a button. */
export const shade = (hex: string, amount = 0.3) => mix(hex, '#000000', amount);
/** Lighter tint. */
export const tint = (hex: string, amount = 0.3) => mix(hex, '#FFFFFF', amount);

/** `#RRGGBB` + alpha (0..1) as `#RRGGBBAA`. */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
  return `${rgbToHex(hexToRgb(hex))}${a}`;
}

/**
 * Deep background version of a team color for the dark Round screen: dark enough that white
 * text clears AA comfortably, saturated enough that the team is obvious at a glance.
 */
export function teamBackground(hex: string): string {
  let amount = 0.45;
  let out = shade(hex, amount);
  while (contrastRatio(WHITE, out) < 7 && amount < 0.9) {
    amount += 0.05;
    out = shade(hex, amount);
  }
  return out;
}

export type Deficiency = 'protanopia' | 'deuteranopia' | 'tritanopia';

/** Machado et al. (2009) severity-1.0 matrices, applied in linear RGB. */
const CVD_MATRICES: Record<Deficiency, number[][]> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

export function simulateCvd(hex: string, kind: Deficiency): string {
  const lin = hexToRgb(hex).map(toLinear);
  const m = CVD_MATRICES[kind];
  const out = m.map((row) => row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2]);
  return rgbToHex(out.map((v) => toSrgb(Math.max(0, Math.min(1, v)))) as RGB);
}

/** CIELAB (D65) for perceptual distances. */
export function hexToLab(hex: string): RGB {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIE76 delta E. ~2.3 is a just-noticeable difference; 20+ reads as clearly different. */
export function deltaE(a: string, b: string): number {
  const la = hexToLab(a);
  const lb = hexToLab(b);
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
}
