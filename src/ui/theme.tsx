import { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { fontSizes, fonts, palette, radii, spacing, type ColorScheme } from './tokens';
import type { Theme, ThemeProviderProps } from './types';

export function makeTheme(scheme: ColorScheme, reduceMotion = false): Theme {
  return { scheme, colors: palette[scheme], fonts, fontSizes, spacing, radii, reduceMotion };
}

const ThemeContext = createContext<Theme | null>(null);

const light = makeTheme('light');
const dark = makeTheme('dark');
const lightReduced = makeTheme('light', true);
const darkReduced = makeTheme('dark', true);

/** Shared, referentially stable theme objects (so memoized children don't re-render). */
function themeFor(scheme: ColorScheme, reduceMotion: boolean): Theme {
  if (scheme === 'dark') return reduceMotion ? darkReduced : dark;
  return reduceMotion ? lightReduced : light;
}

/** OS-derived theme used when no provider is mounted. */
function useOsTheme(): Theme {
  const os = useColorScheme();
  const reduce = useReducedMotion();
  return themeFor(os === 'dark' ? 'dark' : 'light', reduce);
}

/**
 * Provides the theme. Nested providers are fine (Screen uses one to force a scheme); an inner
 * provider inherits the outer reduceMotion unless it is given one explicitly.
 */
export function ThemeProvider({ scheme = 'system', reduceMotion, children }: ThemeProviderProps) {
  const os = useOsTheme();
  const parent = useContext(ThemeContext);
  const resolved: ColorScheme = scheme === 'system' ? os.scheme : scheme;
  const rm = reduceMotion ?? parent?.reduceMotion ?? os.reduceMotion;
  const value = useMemo(() => themeFor(resolved, rm), [resolved, rm]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Current theme. Outside any provider it follows the OS color scheme and reduce-motion. */
export function useTheme(): Theme {
  const os = useOsTheme();
  return useContext(ThemeContext) ?? os;
}
