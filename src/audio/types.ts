/**
 * AudioService contract (PRD section 7). FROZEN after Phase 0.
 */

export type HapticKind = 'tap' | 'tick' | 'success' | 'caught' | 'warning';

export interface BuzzerInfo {
  id: string;
  /** Human label for the settings picker, e.g. "Air Horn". */
  name: string;
}

export interface AudioService {
  /** Load every sound into memory. Call once at launch; resolves when ready. Safe to call twice. */
  preload(): Promise<void>;
  /**
   * Start or update the fuse tick loop. progress 0..1; tempo accelerates with progress.
   * Tick intervals carry random jitter so remaining time can't be read from tempo alone.
   * Calling repeatedly just updates progress. Also fires a 'tick' haptic per tick when enabled.
   */
  startTicking(progress0to1: number): void;
  stopTicking(): void;
  /** 'random' picks uniformly among all buzzers. */
  playBuzzer(id: string | 'random'): void;
  /** Short UI sounds. */
  playSfx(kind: 'gotIt' | 'skip' | 'win' | 'point'): void;
  haptic(kind: HapticKind): void;
  listBuzzers(): BuzzerInfo[];
  /** Apply user settings. Muted => no sound; hapticsEnabled false => no haptics. */
  configure(opts: { soundEnabled: boolean; volume: number; hapticsEnabled: boolean; respectSilentMode: boolean }): void;
}
