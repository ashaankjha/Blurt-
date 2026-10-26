import { normalizePhraseKey, PackSchema, slugify } from './schema';

describe('content schema', () => {
  const pack = {
    id: 'food-drink',
    name: 'Food & Drink',
    emoji: '🍕',
    description: 'Snacks.',
    tags: ['family'],
    version: 1,
    phrases: [{ id: 'food-drink:pizza', text: 'Pizza', difficulty: 1 }],
  };

  it('accepts a valid pack', () => {
    expect(PackSchema.safeParse(pack).success).toBe(true);
  });

  it('rejects phrases over 5 words or 32 chars', () => {
    const bad = { ...pack, phrases: [{ id: 'food-drink:x', text: 'one two three four five six', difficulty: 1 }] };
    expect(PackSchema.safeParse(bad).success).toBe(false);
    const long = { ...pack, phrases: [{ id: 'food-drink:y', text: 'x'.repeat(33), difficulty: 1 }] };
    expect(PackSchema.safeParse(long).success).toBe(false);
  });

  it('rejects internal duplicates case- and punctuation-insensitively', () => {
    const dup = {
      ...pack,
      phrases: [
        { id: 'food-drink:mac-and-cheese', text: 'Mac & Cheese', difficulty: 1 },
        { id: 'food-drink:mac-and-cheese-2', text: 'mac and cheese!', difficulty: 1 },
      ],
    };
    expect(PackSchema.safeParse(dup).success).toBe(false);
  });

  it('normalizes and slugifies', () => {
    expect(normalizePhraseKey("Rock 'n' Roll!")).toBe('rock n roll');
    expect(slugify('Piña Colada')).toBe('pina-colada');
  });
});
