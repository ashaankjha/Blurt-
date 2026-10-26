/** Test fixtures for the content runtime. Not imported by app code. */
import { slugify, type Pack, type PackMeta, type PackTag } from '../../../content/schema';

export function makePack(id: string, texts: string[], tags: PackTag[] = ['family'], extra: Partial<Pack> = {}): Pack {
  return {
    id,
    name: id,
    emoji: '🧪',
    description: `${id} pack`,
    tags,
    version: 1,
    phrases: texts.map((text) => ({ id: `${id}:${slugify(text)}`, text, difficulty: 1 })),
    ...extra,
  };
}

/** `count` unique phrases like "Thing 12 Alpha" (two-word, schema-valid). */
export function makeBigPack(id: string, count: number, tags: PackTag[] = ['family']): Pack {
  return makePack(
    id,
    Array.from({ length: count }, (_, i) => `${id} ${i}`),
    tags,
  );
}

export const FOOD = makePack('food-drink', ['Pizza', 'Hot Dog', 'Pancakes', 'Lemonade', 'French Fries', 'Tacos']);
export const ANIMALS = makePack('animals', ['Giraffe', 'Penguin', 'Kangaroo', 'Octopus'], ['family', 'kids']);
/** "pizza!" collides with food-drink's "Pizza" after normalization. */
export const KIDS = makePack('kids', ['pizza!', 'Balloon', 'Crayon'], ['family', 'kids']);
export const MOVIES = makePack('movies', ['Jaws', 'Titanic', 'Up'], ['hard']);
export const PARTY = makePack('party', ['Walk Of Shame', 'Bar Crawl'], ['adult']);

export const FIXTURE_PACKS = [FOOD, ANIMALS, KIDS, MOVIES, PARTY];

const toMeta = ({ phrases, ...meta }: Pack): PackMeta => ({ ...meta, phraseCount: phrases.length });

export function fixtureDeps(packs: Pack[] = FIXTURE_PACKS) {
  const calls: Record<string, number> = {};
  const loaders = Object.fromEntries(
    packs.map((p) => [
      p.id,
      () => {
        calls[p.id] = (calls[p.id] ?? 0) + 1;
        return p;
      },
    ]),
  );
  return { manifest: packs.map(toMeta), loaders, calls };
}

/** Deterministic PRNG (mulberry32). */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
