/**
 * Theme tokens (PRD section 5). Phase 0 contract: Agent E may add tokens and tune values,
 * but must not rename or remove exports.
 *
 * Team colors start from the Okabe-Ito color-blind-safe set (saturated for a toy-like look)
 * and are always paired with a name, so color is never the only signal. Values are verified
 * by src/ui/tokens.test.ts:
 *  - every team color has a text color (`text`) with WCAG AA (>= 4.5:1) contrast on it;
 *  - every pair stays apart (CIE76 delta E >= 10) under protanopia, deuteranopia and
 *    tritanopia simulation;
 *  - `deep` (Round-screen background tint) holds white text at >= 7:1.
 */

export const TEAM_COLORS = [
  { name: 'Blue', hex: '#1A6BD6', text: '#FFFFFF', deep: '#0E3B76' },
  { name: 'Orange', hex: '#EE8200', text: '#1B1530', deep: '#834800' },
  { name: 'Pink', hex: '#F07AB6', text: '#1B1530', deep: '#844364' },
  { name: 'Teal', hex: '#00806A', text: '#FFFFFF', deep: '#00463A' },
  { name: 'Yellow', hex: '#F2D200', text: '#1B1530', deep: '#615400' },
  { name: 'Red', hex: '#CC3D0B', text: '#FFFFFF', deep: '#702206' },
] as const;

export type TeamColor = (typeof TEAM_COLORS)[number];

/** Looks up a team color entry by hex (case-insensitive). */
export function findTeamColor(hex: string): TeamColor | undefined {
  const h = hex.toUpperCase();
  return TEAM_COLORS.find((c) => c.hex === h);
}

/**
 * `xText` is the label color drawn ON an `x` fill (AA >= 4.5:1). Every foreground token
 * (text, textMuted, primary, danger, success, secondary) is AA on background and surface.
 * Light mode uses deep fills with white labels; dark mode uses bright fills with ink labels.
 */
export const palette = {
  light: {
    background: '#FFF7EC',
    surface: '#FFFFFF',
    surfaceAlt: '#FFE9C7',
    text: '#1B1530',
    textMuted: '#5E5675',
    primary: '#D42644',
    primaryText: '#FFFFFF',
    secondary: '#6C4CF1',
    secondaryText: '#FFFFFF',
    border: '#1B1530',
    shadow: '#1B1530',
    success: '#117A3A',
    danger: '#C8281C',
    /** Text on a `success` fill. */
    successText: '#FFFFFF',
    /** Text on a `danger` fill. */
    dangerText: '#FFFFFF',
    /** Unfilled track (sliders, fuse, progress pips). */
    track: '#EADCC6',
    /** Text input background. */
    inputBackground: '#FFFFFF',
    /** Scrim behind modals/overlays. */
    overlay: '#1B1530B3',
    /** Neutral surface for the paused phrase placeholder. */
    placeholder: '#E9DDF7',
  },
  /** Round screen is dark-mode-first for dim rooms at arm's length. */
  dark: {
    background: '#141024',
    surface: '#221B3A',
    surfaceAlt: '#2E2650',
    text: '#FFFFFF',
    textMuted: '#B9B2D3',
    primary: '#FF5C70',
    primaryText: '#141024',
    secondary: '#9C86FF',
    secondaryText: '#141024',
    border: '#000000',
    shadow: '#000000',
    success: '#3DD27F',
    danger: '#FF6B5E',
    successText: '#141024',
    dangerText: '#141024',
    track: '#3A3160',
    inputBackground: '#2E2650',
    overlay: '#000000B3',
    placeholder: '#2E2650',
  },
} as const;

export type ColorScheme = keyof typeof palette;
export type Palette = { [K in keyof (typeof palette)['light']]: string };

export const fonts = {
  /** Loaded in app/_layout.tsx from @expo-google-fonts/baloo-2. */
  regular: 'Baloo2_500Medium',
  bold: 'Baloo2_700Bold',
  black: 'Baloo2_800ExtraBold',
} as const;

export const fontSizes = {
  xs: 14,
  sm: 16,
  md: 18,
  lg: 22,
  xl: 28,
  xxl: 36,
  display: 48,
  /** PhraseText never renders below this (PRD: min 40 pt). */
  phraseMin: 40,
  phraseMax: 96,
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

export const radii = { sm: 10, md: 16, lg: 24, pill: 999 } as const;

/** Chunky "toy" drop shadow: a solid offset block under buttons and cards. */
export const chunkyShadow = { offsetY: 6, borderWidth: 3 } as const;

/** Minimum touch target (accessibility). */
export const minTouch = 48;

/**
 * AppText variants. `maxScale` caps Dynamic Type growth so big headings don't explode the
 * layout while body text can still scale a lot. Baloo 2 has tall ascenders, so line heights
 * are generous (about 1.3x) to avoid clipping.
 */
export const textVariants = {
  display: { font: fonts.black, size: fontSizes.display, lineHeight: 60, maxScale: 1.3 },
  title: { font: fonts.black, size: fontSizes.xxl, lineHeight: 46, maxScale: 1.4 },
  heading: { font: fonts.bold, size: fontSizes.xl, lineHeight: 36, maxScale: 1.5 },
  body: { font: fonts.regular, size: fontSizes.md, lineHeight: 26, maxScale: 2 },
  caption: { font: fonts.regular, size: fontSizes.xs, lineHeight: 20, maxScale: 2 },
  label: { font: fonts.bold, size: fontSizes.sm, lineHeight: 22, maxScale: 1.8 },
} as const;

/** Phrase line height as a multiple of font size (Baloo 2 needs room for diacritics). */
export const phraseLineHeight = 1.2;

/** Button sizes: label font size, vertical padding and minimum height. */
export const buttonSizes = {
  sm: { fontSize: fontSizes.sm, paddingV: 8, paddingH: 16, minHeight: minTouch },
  md: { fontSize: fontSizes.md, paddingV: 12, paddingH: 20, minHeight: 56 },
  lg: { fontSize: fontSizes.lg, paddingV: 14, paddingH: 24, minHeight: 64 },
  xl: { fontSize: fontSizes.xl, paddingV: 18, paddingH: 28, minHeight: 84 },
} as const;

/** Animation durations (ms). Everything is skipped when the OS asks for reduced motion. */
export const motion = { press: 70, quick: 150, base: 250, slow: 450, confetti: 1800 } as const;

/** Chill-mode fuse colors by remaining length (plenty / getting short / about to blow). */
export const fuseColors = { plenty: '#F2D200', short: '#EE8200', critical: '#FF5C70' } as const;
