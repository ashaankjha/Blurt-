/**
 * Theme tokens (PRD section 5). Phase 0 contract: Agent E may add tokens and tune values,
 * but must not rename or remove exports.
 *
 * Team colors are drawn from the Okabe-Ito color-blind-safe set (saturated for a toy-like look)
 * and always paired with a name, so color is never the only signal.
 */

export const TEAM_COLORS = [
  { name: 'Blue', hex: '#1F7AE0' },
  { name: 'Orange', hex: '#F28C00' },
  { name: 'Pink', hex: '#D9478F' },
  { name: 'Teal', hex: '#009E83' },
  { name: 'Yellow', hex: '#E8C400' },
  { name: 'Red', hex: '#D4440F' },
] as const;

export const palette = {
  light: {
    background: '#FFF7EC',
    surface: '#FFFFFF',
    surfaceAlt: '#FFE9C7',
    text: '#1B1530',
    textMuted: '#5E5675',
    primary: '#FF4F64',
    primaryText: '#FFFFFF',
    secondary: '#6C4CF1',
    secondaryText: '#FFFFFF',
    border: '#1B1530',
    shadow: '#1B1530',
    success: '#1FA35B',
    danger: '#D92D20',
  },
  /** Round screen is dark-mode-first for dim rooms at arm's length. */
  dark: {
    background: '#141024',
    surface: '#221B3A',
    surfaceAlt: '#2E2650',
    text: '#FFFFFF',
    textMuted: '#B9B2D3',
    primary: '#FF5C70',
    primaryText: '#FFFFFF',
    secondary: '#8F75FF',
    secondaryText: '#FFFFFF',
    border: '#000000',
    shadow: '#000000',
    success: '#3DD27F',
    danger: '#FF6B5E',
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
