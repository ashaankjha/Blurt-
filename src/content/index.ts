/**
 * ContentService. Phase 0 STUB with a tiny in-memory pack set: Agent B replaces it with the real
 * loader over content/packs, keeping the exported names.
 */
import type { Pack, PackMeta, Phrase } from '../../content/schema';
import type { ContentService } from './types';

export * from './types';

const STUB_PACKS: Pack[] = [
  {
    id: 'food-drink',
    name: 'Food & Drink',
    emoji: '🍕',
    description: 'Snacks, dishes and drinks.',
    tags: ['family'],
    version: 1,
    phrases: ['Pizza', 'Hot Dog', 'Pancakes', 'Lemonade', 'French Fries'].map((text) => ({
      id: `food-drink:${text.toLowerCase().replace(/\s+/g, '-')}`,
      text,
      difficulty: 1 as const,
    })),
  },
  {
    id: 'animals',
    name: 'Animals',
    emoji: '🦒',
    description: 'Creatures great and small.',
    tags: ['family', 'kids'],
    version: 1,
    phrases: ['Giraffe', 'Penguin', 'Kangaroo', 'Octopus', 'Golden Retriever'].map((text) => ({
      id: `animals:${text.toLowerCase().replace(/\s+/g, '-')}`,
      text,
      difficulty: 1 as const,
    })),
  },
];

const toMeta = ({ phrases, ...meta }: Pack): PackMeta => ({ ...meta, phraseCount: phrases.length });

export const contentService: ContentService = {
  listPacks: () => STUB_PACKS.map(toMeta),
  getPack: (id) => STUB_PACKS.find((p) => p.id === id),
  createDrawer: (packIds, rng = Math.random) => {
    const pool: Phrase[] = STUB_PACKS.filter((p) => packIds.includes(p.id)).flatMap((p) => p.phrases);
    if (pool.length === 0) throw new Error('No phrases in selected packs');
    return () => pool[Math.floor(rng() * pool.length)];
  },
  markSeen: () => {},
  resetHistory: () => {},
  seenCount: () => 0,
};
