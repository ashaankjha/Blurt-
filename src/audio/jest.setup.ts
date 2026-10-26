// Jest setup for src/audio (mocks for native modules). Owned by the src/audio agent.
// Mocks expo-audio and expo-haptics for every test in the repo so anything can import `audioService`.
// Inspect what was played via `audioMock` / `hapticsMock` from src/audio/nativeMocks.
/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must use require() */
jest.mock('expo-audio', () => require('./nativeMocks').createExpoAudioMock());
jest.mock('expo-haptics', () => require('./nativeMocks').createExpoHapticsMock());
/* eslint-enable @typescript-eslint/no-require-imports */

export {};
