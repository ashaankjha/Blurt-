/**
 * ContentService contract (PRD section 7). FROZEN after Phase 0.
 * All methods are synchronous: packs are bundled, persistence uses expo-sqlite/kv-store sync APIs.
 */
import type { Pack, PackMeta, Phrase } from '../../content/schema';

export interface ListPacksOptions {
  /** Include packs tagged 'adult'. Callers pass the settings' After Dark toggle. Default false. */
  includeAdult?: boolean;
}

export interface ContentService {
  /**
   * Every selectable pack, including the virtual "everything-mix" pack (union of all
   * family-tagged packs, phrases keep their original ids) and custom packs.
   */
  listPacks(opts?: ListPacksOptions): PackMeta[];
  getPack(id: string): Pack | undefined;
  /**
   * Returns a draw function for one game. Never repeats a phrase within the game.
   * Across games, honors the persisted per-pack "seen" history: unseen phrases first; when a
   * pack is exhausted its history resets. Every drawn phrase is marked seen.
   * Throws if packIds resolve to zero phrases.
   */
  createDrawer(packIds: string[], rng?: () => number): () => Phrase;
  markSeen(phraseId: string): void;
  /** Reset one pack's history, or all history when packId is omitted. */
  resetHistory(packId?: string): void;
  /** Phrase ids are `${packId}:${slug}`; returns how many of a pack's phrases are marked seen. */
  seenCount(packId: string): number;
}

/** P1 (F12) custom packs. Phase 1 ships a stub that stores packs but the UI comes later. */
export interface CustomPackService {
  list(): Pack[];
  save(pack: Pack): void;
  remove(id: string): void;
  /** Compressed JSON share code (base64url). */
  encode(pack: Pack): string;
  /** Validates with Zod; throws on invalid input. */
  decode(code: string): Pack;
}
