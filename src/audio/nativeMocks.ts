/**
 * Jest-only mocks for expo-audio and expo-haptics, installed globally by src/audio/jest.setup.ts.
 * Tests can inspect `audioMock` (players created, sounds played, audio mode) and `hapticsMock`.
 * Not imported by app code.
 */

export interface MockPlayer {
  source: unknown;
  volume: number;
  playing: boolean;
  play: jest.Mock;
  pause: jest.Mock;
  seekTo: jest.Mock;
  replace: jest.Mock;
  remove: jest.Mock;
  addListener: jest.Mock;
}

export const audioMock = {
  players: [] as MockPlayer[],
  /** Source of every play() call, in order. */
  played: [] as unknown[],
  audioModes: [] as Record<string, unknown>[],
  reset() {
    this.players.length = 0;
    this.played.length = 0;
    this.audioModes.length = 0;
  },
};

export const hapticsMock = {
  /** e.g. 'impact:light', 'notification:error', 'selection'. */
  calls: [] as string[],
  reset() {
    this.calls.length = 0;
  },
};

function createMockPlayer(source: unknown): MockPlayer {
  const player: MockPlayer = {
    source,
    volume: 1,
    playing: false,
    play: jest.fn(() => {
      player.playing = true;
      audioMock.played.push(player.source);
    }),
    pause: jest.fn(() => {
      player.playing = false;
    }),
    seekTo: jest.fn(() => Promise.resolve()),
    replace: jest.fn((next: unknown) => {
      player.source = next;
    }),
    remove: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  };
  audioMock.players.push(player);
  return player;
}

export function createExpoAudioMock() {
  return {
    createAudioPlayer: jest.fn((source: unknown) => createMockPlayer(source)),
    useAudioPlayer: jest.fn((source: unknown) => createMockPlayer(source)),
    useAudioPlayerStatus: jest.fn(() => ({ playing: false, currentTime: 0, duration: 0, isLoaded: true })),
    setAudioModeAsync: jest.fn((mode: Record<string, unknown>) => {
      audioMock.audioModes.push(mode);
      return Promise.resolve();
    }),
    setIsAudioActiveAsync: jest.fn(() => Promise.resolve()),
    preload: jest.fn(() => Promise.resolve()),
    clearPreloadedSource: jest.fn(() => Promise.resolve()),
    clearAllPreloadedSources: jest.fn(() => Promise.resolve()),
    getPreloadedSources: jest.fn(() => Promise.resolve([])),
  };
}

export function createExpoHapticsMock() {
  const record = (name: string) => () => {
    hapticsMock.calls.push(name);
    return Promise.resolve();
  };
  return {
    ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy', Soft: 'soft', Rigid: 'rigid' },
    NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
    impactAsync: jest.fn((style: string = 'medium') => record(`impact:${style}`)()),
    notificationAsync: jest.fn((type: string = 'success') => record(`notification:${type}`)()),
    selectionAsync: jest.fn(record('selection')),
    performAndroidHapticsAsync: jest.fn((type: string) => record(`android:${type}`)()),
  };
}
