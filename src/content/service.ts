/**
 * ContentService implementation (PRD section 7). `createContentService` takes its packs and
 * storage as dependencies so tests can inject fixtures; `src/content/index.ts` builds the app
 * instance from the generated `content/packs/index.ts`.
 */
import { normalizePhraseKey, type Pack, type PackMeta, type Phrase } from '../../content/schema';
import { EVERYTHING_MIX_ID } from '../config';
import { buildDrawer } from './drawer';
import { SeenHistory } from './history';
import { KV_KEYS, type KV } from './kv';
import type { ContentService, CustomPackService } from './types';

export interface ContentServiceDeps {
  /** Bundled pack metadata (generated `PACK_MANIFEST`). */
  manifest: PackMeta[];
  /** Lazy bundled pack loaders (generated `PACK_LOADERS`), keyed by pack id. */
  loaders: Record<string, () => Pack>;
  kv: KV;
  customPacks?: CustomPackService;
}

export const EVERYTHING_MIX_META: Omit<PackMeta, 'phraseCount'> = {
  id: EVERYTHING_MIX_ID,
  name: 'Everything Mix',
  emoji: '🎉',
  description: 'Every family pack shuffled together.',
  tags: ['family'],
  version: 1,
};

const isAdult = (p: { tags: readonly string[] }) => p.tags.includes('adult');
/** Packs that feed Everything Mix (and Quick Play): family-tagged, never adult. */
const isMixPack = (p: { tags: readonly string[] }) => p.tags.includes('family') && !isAdult(p);

const toMeta = ({ phrases, ...meta }: Pack): PackMeta => ({ ...meta, phraseCount: phrases.length });

export function createContentService({ manifest, loaders, kv, customPacks }: ContentServiceDeps): ContentService {
  const history = new SeenHistory(kv);
  const bundledMeta = new Map(manifest.map((m) => [m.id, m]));
  const loaded = new Map<string, Pack>();
  const keyCache = new WeakMap<Pack, string[]>();
  const mixIds = manifest.filter(isMixPack).map((m) => m.id);
  let mixPack: Pack | null = null;
  let mixCount: number | null = null;

  function loadBundled(id: string): Pack | undefined {
    let pack = loaded.get(id);
    if (!pack) {
      const loader = loaders[id];
      if (!loader || !bundledMeta.has(id)) return undefined;
      pack = loader();
      loaded.set(id, pack);
    }
    return pack;
  }

  function keysOf(pack: Pack): string[] {
    let keys = keyCache.get(pack);
    if (!keys) {
      keys = pack.phrases.map((p) => normalizePhraseKey(p.text));
      keyCache.set(pack, keys);
    }
    return keys;
  }

  function mixSources(): Pack[] {
    return mixIds.map(loadBundled).filter((p): p is Pack => !!p);
  }

  /** Virtual pack: distinct phrases (by normalized text) of all family packs, original ids kept. */
  function getMixPack(): Pack {
    if (mixPack) return mixPack;
    const seen = new Set<string>();
    const phrases: Phrase[] = [];
    for (const pack of mixSources()) {
      const keys = keysOf(pack);
      pack.phrases.forEach((p, i) => {
        if (seen.has(keys[i])) return;
        seen.add(keys[i]);
        phrases.push(p);
      });
    }
    mixPack = { ...EVERYTHING_MIX_META, tags: [...EVERYTHING_MIX_META.tags], phrases };
    mixCount = phrases.length;
    return mixPack;
  }

  /**
   * Distinct phrase count for the mix. Computing it parses every family pack, so the result is
   * cached in kv keyed by the family packs' ids + versions; later cold starts skip the parse.
   */
  function getMixCount(): number {
    if (mixCount !== null) return mixCount;
    const sig = manifest
      .filter(isMixPack)
      .map((m) => `${m.id}@${m.version}:${m.phraseCount}`)
      .join('|');
    try {
      const cached = JSON.parse(kv.get(KV_KEYS.mixCount) ?? 'null');
      if (cached && cached.sig === sig && typeof cached.count === 'number') return (mixCount = cached.count);
    } catch {
      // ignore corrupt cache
    }
    const count = getMixPack().phrases.length;
    kv.set(KV_KEYS.mixCount, JSON.stringify({ sig, count }));
    return count;
  }

  function findCustom(id: string): Pack | undefined {
    return customPacks?.list().find((p) => p.id === id);
  }

  function getPack(id: string): Pack | undefined {
    if (id === EVERYTHING_MIX_ID) return getMixPack();
    return loadBundled(id) ?? findCustom(id);
  }

  /** Expands the mix, dedupes ids, drops unknown ids; bundled packs win over custom ones. */
  function resolveSources(packIds: string[]): Pack[] {
    const ids = new Set<string>();
    for (const id of packIds) {
      if (id === EVERYTHING_MIX_ID) mixIds.forEach((m) => ids.add(m));
      else ids.add(id);
    }
    const packs: Pack[] = [];
    for (const id of ids) {
      const pack = loadBundled(id) ?? findCustom(id);
      if (pack) packs.push(pack);
    }
    return packs;
  }

  function seenCount(packId: string): number {
    if (packId === EVERYTHING_MIX_ID) {
      // A mix phrase counts as seen when any family pack's copy of it is seen.
      const seenKeys = new Set<string>();
      for (const pack of mixSources()) {
        const keys = keysOf(pack);
        const set = history.get(pack.id);
        pack.phrases.forEach((p, i) => {
          if (set.has(p.id)) seenKeys.add(keys[i]);
        });
      }
      return seenKeys.size;
    }
    const set = history.get(packId);
    const pack = getPack(packId);
    if (!pack) return set.size;
    let count = 0;
    for (const p of pack.phrases) if (set.has(p.id)) count++;
    return count;
  }

  return {
    listPacks({ includeAdult = false } = {}) {
      const visible = (p: { tags: readonly string[] }) => includeAdult || !isAdult(p);
      return [
        { ...EVERYTHING_MIX_META, tags: [...EVERYTHING_MIX_META.tags], phraseCount: getMixCount() },
        ...manifest.filter(visible),
        ...(customPacks?.list() ?? []).filter((p) => visible(p) && !bundledMeta.has(p.id)).map(toMeta),
      ];
    },
    getPack,
    createDrawer(packIds, rng = Math.random) {
      return buildDrawer(resolveSources(packIds), keysOf, history, rng);
    },
    markSeen(phraseId) {
      history.add(phraseId);
    },
    resetHistory(packId) {
      if (packId === EVERYTHING_MIX_ID) mixIds.forEach((id) => history.reset(id));
      else history.reset(packId);
    },
    seenCount,
  };
}
