/**
 * Sound catalog: the generated asset manifest plus small lookups.
 * Assets live in assets/sounds/ and are produced by scripts/gen-sounds/build.ts.
 */
import type { BuzzerInfo } from './types';
import { BUZZER_ASSETS, SFX_ASSETS, TICK_ASSETS } from './sounds.generated';

export interface SoundAsset {
  id: string;
  /** Human label. */
  name: string;
  /** File name inside assets/sounds/. */
  file: string;
  /** Metro asset module id from require(). */
  source: number;
}

export type SfxKind = keyof typeof SFX_ASSETS;
export type TickKind = keyof typeof TICK_ASSETS;

export { BUZZER_ASSETS, SFX_ASSETS, TICK_ASSETS };

export const BUZZER_INFOS: readonly BuzzerInfo[] = BUZZER_ASSETS.map(({ id, name }) => ({ id, name }));

const byId = new Map(BUZZER_ASSETS.map((b) => [b.id, b]));

export function findBuzzer(id: string): SoundAsset | undefined {
  return byId.get(id);
}
