import { Baloo2_500Medium, Baloo2_700Bold, Baloo2_800ExtraBold, useFonts } from '@expo-google-fonts/baloo-2';
import { router, Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { audioService } from '../src/audio';
import type { Phase } from '../src/engine/types';
import { useGame } from '../src/store/game';
import { installGameLifecycle } from '../src/store/gameLifecycle';
import { useSettings } from '../src/store/settings';
import { ThemeProvider } from '../src/ui';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Routes that only make sense while a game is in progress. */
const IN_GAME_ROUTES = ['/round', '/caught', '/scoreboard', '/win'];

function routeForPhase(phase: Phase | null): string | null {
  switch (phase) {
    case 'playing':
    case 'paused':
      return '/round';
    case 'caught':
      return '/caught';
    case 'scoreboard':
      return '/scoreboard';
    case 'won':
      return '/win';
    default:
      return null;
  }
}

function goHome() {
  if (router.canDismiss()) router.dismissAll();
  else router.replace('/');
}

/**
 * Single place that maps `game.phase` to a route. Screens never navigate to in-game routes
 * themselves: they call a store action (quickPlay, startGame, showScoreboard, nextRound,
 * playAgain, quitGame...) and this component follows the resulting phase. That keeps the UI
 * correct whatever order the real engine moves through phases in.
 */
function GamePhaseRouter() {
  const phase = useGame((s) => s.game?.phase ?? null);
  const pathname = usePathname();

  useEffect(() => {
    const target = routeForPhase(phase);
    const inGame = IN_GAME_ROUTES.includes(pathname);
    if (target) {
      if (pathname === target) return;
      if (inGame) router.replace(target as never);
      else router.push(target as never);
    } else if (inGame && phase === null) {
      goHome();
    }
  }, [phase, pathname]);

  // Android hardware back never leaves a game by accident: it pauses the round instead.
  useEffect(() => {
    if (!IN_GAME_ROUTES.includes(pathname)) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const { game, pause } = useGame.getState();
      if (game?.phase === 'playing') pause();
      return true;
    });
    return () => sub.remove();
  }, [pathname]);

  return null;
}

// Test hook for dev builds and E2E web builds (EXPO_PUBLIC_E2E_HOOKS=1): lets Playwright drive the
// store (e.g. fake a blown fuse on the mock). Never enabled in store builds.
if ((__DEV__ || process.env.EXPO_PUBLIC_E2E_HOOKS === '1') && typeof window !== 'undefined') {
  (window as unknown as { __blurt?: unknown }).__blurt = { useGame, useSettings };
}

const IN_GAME_OPTIONS = { gestureEnabled: false, fullScreenGestureEnabled: false } as const;

export default function RootLayout() {
  const [loaded, error] = useFonts({ Baloo2_500Medium, Baloo2_700Bold, Baloo2_800ExtraBold });

  // Audio settings now and on change, plus the single AppState listener that pauses a round when
  // the app is backgrounded or interrupted (src/store/gameLifecycle.ts).
  useEffect(() => installGameLifecycle({ game: useGame, settings: useSettings, audio: audioService }), []);

  // Load every sound once, off the first-render path. Never rejects.
  useEffect(() => {
    void audioService.preload();
    // Web code-splits routes (expo-router asyncRoutes); fetch the in-game screens now so nothing
    // is downloaded mid-round. Native builds bundle every route, so this is web-only.
    if (Platform.OS === 'web') {
      Promise.all([import('./round'), import('./caught'), import('./scoreboard'), import('./win')]).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider scheme="system">
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false, orientation: 'portrait' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="setup" />
          <Stack.Screen name="packs" />
          <Stack.Screen name="how-to-play" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="settings" />
          <Stack.Screen name="round" options={{ ...IN_GAME_OPTIONS, animation: 'fade' }} />
          <Stack.Screen name="caught" options={{ ...IN_GAME_OPTIONS, animation: 'fade' }} />
          <Stack.Screen name="scoreboard" options={{ ...IN_GAME_OPTIONS, animation: 'fade' }} />
          <Stack.Screen name="win" options={{ ...IN_GAME_OPTIONS, animation: 'fade' }} />
        </Stack>
        <GamePhaseRouter />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
