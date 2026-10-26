// Jest setup for src/ui (mocks for native modules). Owned by the src/ui agent.
/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require */

// Reanimated 4 + worklets need native modules. Use the libraries' own mocks. Reanimated's mock
// imports its real index, whose native initializer would call into JSReanimated, so that one
// module is stubbed. (The official route is reanimated's jest resolver in package.json, which
// src/ui does not own.)
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated/src/initializers.native.ts', () => ({
  initializeReanimatedModule: () => {},
}));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
