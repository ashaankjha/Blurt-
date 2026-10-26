/**
 * Persisted per-pack "seen" history (PRD F7). One kv entry per pack holding the seen phrase ids,
 * loaded lazily and cached in memory; every change is written through synchronously so it
 * survives an app restart.
 */
import { KV_KEYS, type KV } from './kv';

/** Phrase ids are `${packId}:${slug}`; pack ids are kebab-case and never contain ':'. */
export function packIdOf(phraseId: string): string {
  const i = phraseId.indexOf(':');
  return i < 0 ? phraseId : phraseId.slice(0, i);
}

export class SeenHistory {
  private cache = new Map<string, Set<string>>();

  constructor(private readonly kv: KV) {}

  private key(packId: string) {
    return KV_KEYS.seenPrefix + packId;
  }

  /** The live seen-set for a pack. Do not mutate; use add/replace/reset. */
  get(packId: string): ReadonlySet<string> {
    return this.load(packId);
  }

  has(phraseId: string): boolean {
    return this.load(packIdOf(phraseId)).has(phraseId);
  }

  /** Marks a phrase seen and persists its pack. Returns false if it was already seen. */
  add(phraseId: string): boolean {
    const packId = packIdOf(phraseId);
    const set = this.load(packId);
    if (set.has(phraseId)) return false;
    set.add(phraseId);
    this.persist(packId, set);
    return true;
  }

  /** Replaces a pack's history (used when a pack is exhausted and starts a new cycle). */
  replace(packId: string, ids: Iterable<string>): void {
    const set = new Set(ids);
    this.cache.set(packId, set);
    this.persist(packId, set);
  }

  reset(packId?: string): void {
    if (packId !== undefined) {
      this.cache.set(packId, new Set());
      this.kv.remove(this.key(packId));
      return;
    }
    this.cache.clear();
    for (const k of this.kv.keys()) if (k.startsWith(KV_KEYS.seenPrefix)) this.kv.remove(k);
  }

  private load(packId: string): Set<string> {
    let set = this.cache.get(packId);
    if (set) return set;
    set = new Set();
    const raw = this.kv.get(this.key(packId));
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) for (const id of parsed) if (typeof id === 'string') set.add(id);
      } catch {
        // Corrupt entry: treat as empty history.
      }
    }
    this.cache.set(packId, set);
    return set;
  }

  private persist(packId: string, set: Set<string>) {
    if (set.size === 0) this.kv.remove(this.key(packId));
    else this.kv.set(this.key(packId), JSON.stringify([...set]));
  }
}
