/**
 * AudioService: fuse ticks, buzzers, UI sfx and haptics (expo-audio + expo-haptics).
 * Usage and device notes: src/audio/HANDOFF.md.
 */
import { createAudioService } from './service';
import type { AudioService } from './types';

export * from './types';

/** App-wide singleton. Call `audioService.preload()` once at launch. */
export const audioService: AudioService = createAudioService();
