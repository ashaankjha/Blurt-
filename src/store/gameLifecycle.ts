/**
 * App-level glue for the game store: lifecycle pause and audio settings.
 *
 * - Backgrounding the app, going inactive (iOS incoming call, Control Center) or losing window
 *   focus on Android (`blur`, e.g. a call's full-screen UI) pauses a playing round: the fuse
 *   freezes and the Round screen hides the phrase. Nothing auto-resumes; the holder taps Resume.
 * - `audioService.configure(...)` runs at install and again whenever a sound/haptics setting
 *   changes.
 *
 * Installed once from app/_layout.tsx. This is the only AppState listener in the app.
 */
import { AppState, type AppStateStatus, Platform } from 'react-native';
import type { StoreApi } from 'zustand';

import type { AudioService } from '../audio/types';
import type { GameStore } from './gameTypes';
import type { Settings, SettingsStore } from './settingsTypes';

type AudioSettings = Pick<Settings, 'soundEnabled' | 'volume' | 'hapticsEnabled' | 'respectSilentMode'>;

export const audioSettingsOf = (s: Settings): AudioSettings => ({
  soundEnabled: s.soundEnabled,
  volume: s.volume,
  hapticsEnabled: s.hapticsEnabled,
  respectSilentMode: s.respectSilentMode,
});

const sameAudioSettings = (a: AudioSettings, b: AudioSettings) =>
  a.soundEnabled === b.soundEnabled &&
  a.volume === b.volume &&
  a.hapticsEnabled === b.hapticsEnabled &&
  a.respectSilentMode === b.respectSilentMode;

/** Applies audio settings now and on every relevant change. Returns an unsubscribe function. */
export function syncAudioSettings(
  settings: Pick<StoreApi<SettingsStore>, 'getState' | 'subscribe'>,
  audio: Pick<AudioService, 'configure'>,
): () => void {
  let last = audioSettingsOf(settings.getState());
  audio.configure(last);
  return settings.subscribe((s) => {
    const next = audioSettingsOf(s);
    if (sameAudioSettings(next, last)) return;
    last = next;
    audio.configure(next);
  });
}

/** Pauses the round when the app is no longer in the foreground. Returns an unsubscribe function. */
export function pauseOnBackground(
  game: Pick<StoreApi<GameStore>, 'getState'>,
  appState: Pick<typeof AppState, 'addEventListener'> = AppState,
  os: string = Platform.OS,
): () => void {
  const pauseIfPlaying = () => {
    const { game: g, pause } = game.getState();
    if (g?.phase === 'playing') pause();
  };
  const subs = [
    appState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') pauseIfPlaying();
    }),
  ];
  // Android reports focus loss (incoming-call screen, notification shade) as 'blur', not a state change.
  if (os === 'android') subs.push(appState.addEventListener('blur', pauseIfPlaying));
  return () => subs.forEach((s) => s.remove());
}

/** Everything app/_layout.tsx needs: lifecycle pause plus audio settings sync. */
export function installGameLifecycle(opts: {
  game: Pick<StoreApi<GameStore>, 'getState'>;
  settings: Pick<StoreApi<SettingsStore>, 'getState' | 'subscribe'>;
  audio: Pick<AudioService, 'configure'>;
}): () => void {
  const offAudio = syncAudioSettings(opts.settings, opts.audio);
  const offPause = pauseOnBackground(opts.game);
  return () => {
    offAudio();
    offPause();
  };
}
