/**
 * AudioService. Phase 0 STUB (silent no-op): Agent D replaces it, keeping the exported names.
 */
import type { AudioService } from './types';

export * from './types';

export const audioService: AudioService = {
  preload: async () => {},
  startTicking: () => {},
  stopTicking: () => {},
  playBuzzer: () => {},
  playSfx: () => {},
  haptic: () => {},
  listBuzzers: () => [],
  configure: () => {},
};
