import * as fc from 'fast-check';

import { normalizePhraseKey, type Pack } from '../../content/schema';
import { EVERYTHING_MIX_ID } from '../config';
import { FOOD, fixtureDeps, makeBigPack, makePack, seededRng } from './__fixtures__/packs';
import { createCustomPackService } from './custom';
import { createMemoryKV, KV_KEYS, type KV } from './kv';
import { createContentService } from './service';

function makeService(kv: KV = createMemoryKV(), packs?: Pack[]) {
  const deps = fixtureDeps(packs);
  const customPacks = createCustomPackService({ kv });
  return { service: createContentService({ ...deps, kv, customPacks }), customPacks, kv, calls: deps.calls };
}

function drawN(draw: () => { id: string }, n: number) {
  return Array.from({ length: n }, () => draw().id);
}

describe('listPacks', () => {
  it('lists Everything Mix first with the distinct family phrase count', () => {
    const { service } = makeService();
    const packs = service.listPacks();
    expect(packs[0]).toMatchObject({ id: EVERYTHING_MIX_ID, name: 'Everything Mix', emoji: '🎉', tags: ['family'] });
    // food 6 + animals 4 + kids 3, minus the shared "Pizza"; movies (not family) excluded.
    expect(packs[0].phraseCount).toBe(12);
    expect(packs.map((p) => p.id)).toEqual([EVERYTHING_MIX_ID, 'food-drink', 'animals', 'kids', 'movies']);
  });

  it('hides adult packs unless includeAdult', () => {
    const { service } = makeService();
    expect(service.listPacks().some((p) => p.tags.includes('adult'))).toBe(false);
    expect(service.listPacks({ includeAdult: false }).map((p) => p.id)).not.toContain('party');
    expect(service.listPacks({ includeAdult: true }).map((p) => p.id)).toContain('party');
  });

  it('does not parse packs on a later cold start (mix count cached in kv)', () => {
    const kv = createMemoryKV();
    makeService(kv).service.listPacks();
    expect(kv.get(KV_KEYS.mixCount)).not.toBeNull();
    const { service, calls } = makeService(kv);
    expect(service.listPacks()[0].phraseCount).toBe(12);
    expect(calls).toEqual({});
  });

  it('lists custom packs last and gates adult custom packs', () => {
    const { service, customPacks } = makeService();
    customPacks.save(makePack('my-pack', ['Grandma', 'Our Dog'], ['custom']));
    customPacks.save(makePack('my-spicy', ['Hot Tub'], ['custom', 'adult']));
    const ids = service.listPacks().map((p) => p.id);
    expect(ids[ids.length - 1]).toBe('my-pack');
    expect(ids).not.toContain('my-spicy');
    expect(service.listPacks({ includeAdult: true }).map((p) => p.id)).toContain('my-spicy');
    expect(service.listPacks().find((p) => p.id === 'my-pack')).toMatchObject({ phraseCount: 2, tags: ['custom'] });
  });
});

describe('getPack', () => {
  it('loads bundled packs lazily and caches them', () => {
    const { service, calls } = makeService();
    expect(calls).toEqual({});
    expect(service.getPack('food-drink')).toBe(FOOD);
    expect(service.getPack('food-drink')).toBe(FOOD);
    expect(calls['food-drink']).toBe(1);
    expect(service.getPack('nope')).toBeUndefined();
  });

  it('builds the virtual Everything Mix from family packs, deduped, keeping original ids', () => {
    const { service } = makeService();
    const mix = service.getPack(EVERYTHING_MIX_ID)!;
    expect(mix.phrases).toHaveLength(12);
    const keys = mix.phrases.map((p) => normalizePhraseKey(p.text));
    expect(new Set(keys).size).toBe(12);
    expect(mix.phrases.map((p) => p.id)).toContain('food-drink:pizza');
    expect(mix.phrases.map((p) => p.id)).not.toContain('kids:pizza');
    expect(mix.phrases.some((p) => p.id.startsWith('movies:') || p.id.startsWith('party:'))).toBe(false);
  });

  it('returns custom packs', () => {
    const { service, customPacks } = makeService();
    customPacks.save(makePack('my-pack', ['Grandma'], ['custom']));
    expect(service.getPack('my-pack')?.phrases[0].text).toBe('Grandma');
  });
});

describe('createDrawer', () => {
  it('throws only when the selection resolves to zero phrases', () => {
    const { service } = makeService();
    expect(() => service.createDrawer([])).toThrow();
    expect(() => service.createDrawer(['does-not-exist'])).toThrow();
    expect(() => service.createDrawer(['does-not-exist', 'animals'])).not.toThrow();
  });

  it('never repeats within a game and starts a fresh cycle instead of throwing', () => {
    const { service } = makeService();
    const draw = service.createDrawer(['food-drink'], seededRng(1));
    const first = drawN(draw, 6);
    expect(new Set(first).size).toBe(6);
    // The new in-game cycle holds back the phrase that ended the last one, so no back-to-back repeat.
    const next = drawN(draw, 5);
    expect(new Set(next).size).toBe(5);
    expect(next).not.toContain(first[5]);
    expect(() => drawN(draw, 50)).not.toThrow();
  });

  it('honors history across games and app restarts until the pack is exhausted', () => {
    const kv = createMemoryKV();
    const pack = makeBigPack('big', 50);
    const ids: string[] = [];
    // Five games of 7 draws, then one of 15: every game on a brand-new service instance.
    for (const [game, len] of [7, 7, 7, 7, 7, 15].entries()) {
      const { service } = makeService(kv, [pack]);
      ids.push(...drawN(service.createDrawer(['big'], seededRng(game)), len));
    }
    expect(ids).toHaveLength(50);
    expect(new Set(ids).size).toBe(50);
  });

  it('property: the first N draws of a pack are distinct for any game split and restarts', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 40 }),
        fc.array(fc.integer({ min: 1, max: 12 }), { minLength: 1, maxLength: 30 }),
        fc.integer(),
        (size, games, seed) => {
          const kv = createMemoryKV();
          const pack = makeBigPack('p', size);
          const rng = seededRng(seed);
          const ids: string[] = [];
          for (const len of games) {
            if (ids.length >= size) break;
            const { service } = makeService(kv, [pack]);
            const draw = service.createDrawer(['p'], rng);
            ids.push(...drawN(draw, Math.min(len, size - ids.length)));
          }
          return new Set(ids).size === ids.length;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('resets a pack history when exhausted, keeping this game draws out of the next game', () => {
    const kv = createMemoryKV();
    const pack = makeBigPack('p', 10);
    const g1 = drawN(makeService(kv, [pack]).service.createDrawer(['p'], seededRng(1)), 8);
    // Game 2 draws the last 2 unseen phrases, exhausting the pack, then 3 more of the new cycle.
    const { service } = makeService(kv, [pack]);
    const g2 = drawN(service.createDrawer(['p'], seededRng(2)), 5);
    expect(new Set([...g1, ...g2.slice(0, 2)]).size).toBe(10);
    expect(new Set(g2).size).toBe(5);
    // New cycle history = what game 2 drew; game 3 gets the other 5 first.
    expect(service.seenCount('p')).toBe(5);
    const g3 = drawN(makeService(kv, [pack]).service.createDrawer(['p'], seededRng(3)), 5);
    expect(new Set([...g2, ...g3]).size).toBe(10);
  });

  it('when a single game uses a whole pack, the next game still avoids the last draw', () => {
    const kv = createMemoryKV();
    const pack = makeBigPack('p', 4);
    const g1 = drawN(makeService(kv, [pack]).service.createDrawer(['p'], seededRng(5)), 4);
    const { service } = makeService(kv, [pack]);
    expect(service.seenCount('p')).toBe(1);
    const g2 = drawN(service.createDrawer(['p'], seededRng(6)), 3);
    expect(g2).not.toContain(g1[3]);
  });

  it('resets history per pack: a small exhausted pack cycles while the big one keeps its history', () => {
    const kv = createMemoryKV();
    const small = makeBigPack('small', 2);
    const big = makeBigPack('big', 30);
    const drawnBig: string[] = [];
    let smallDraws = 0;
    for (let game = 0; game < 40 && drawnBig.length < 30; game++) {
      const { service } = makeService(kv, [small, big]);
      const id = service.createDrawer(['small', 'big'], seededRng(game))().id;
      if (id.startsWith('big:')) drawnBig.push(id);
      else smallDraws++;
    }
    expect(new Set(drawnBig).size).toBe(drawnBig.length);
    expect(smallDraws).toBeGreaterThan(2); // small pack recycled before big was exhausted
  });

  it('draws uniformly over unseen phrases', () => {
    const { service } = makeService(createMemoryKV(), [makeBigPack('p', 5)]);
    const counts: Record<string, number> = {};
    const rng = seededRng(42);
    for (let i = 0; i < 5000; i++) {
      service.resetHistory();
      const id = service.createDrawer(['p'], rng)().id;
      counts[id] = (counts[id] ?? 0) + 1;
    }
    expect(Object.keys(counts)).toHaveLength(5);
    for (const c of Object.values(counts)) expect(Math.abs(c - 1000)).toBeLessThan(150);
  });

  it('expands Everything Mix to all family packs and dedupes shared phrases', () => {
    const { service } = makeService();
    const draw = service.createDrawer([EVERYTHING_MIX_ID, 'food-drink', 'kids'], seededRng(3));
    const phrases = Array.from({ length: 12 }, draw);
    const keys = phrases.map((p) => normalizePhraseKey(p.text));
    expect(new Set(keys).size).toBe(12);
    expect(keys.filter((k) => k === 'pizza')).toHaveLength(1);
    const packsDrawn = new Set(phrases.map((p) => p.id.split(':')[0]));
    expect([...packsDrawn].sort()).toEqual(['animals', 'food-drink', 'kids']);
  });

  it('marks every pack copy of a drawn phrase seen', () => {
    const { service } = makeService();
    // rng 0 picks the first pooled phrase: food-drink's "Pizza".
    expect(service.createDrawer([EVERYTHING_MIX_ID], () => 0)().id).toBe('food-drink:pizza');
    expect(service.seenCount('food-drink')).toBe(1);
    expect(service.seenCount('kids')).toBe(1);
    expect(service.seenCount('animals')).toBe(0);
    expect(service.seenCount(EVERYTHING_MIX_ID)).toBe(1);
  });

  it('does not serve a phrase seen via another pack as fresh in the mix', () => {
    const { service } = makeService();
    service.markSeen('kids:pizza');
    const draw = service.createDrawer([EVERYTHING_MIX_ID], seededRng(9));
    const texts = Array.from({ length: 11 }, () => normalizePhraseKey(draw().text));
    expect(texts).not.toContain('pizza');
  });

  it('draws custom packs', () => {
    const { service, customPacks } = makeService();
    customPacks.save(makePack('my-pack', ['Grandma', 'Our Dog'], ['custom']));
    const draw = service.createDrawer(['my-pack']);
    expect(service.seenCount('my-pack')).toBe(0);
    expect([draw().text, draw().text].sort()).toEqual(['Grandma', 'Our Dog']);
    // Exhausted: history reset, keeping only the latest draw.
    expect(service.seenCount('my-pack')).toBe(1);
  });

  it('stays fast with 10k phrases', () => {
    const packs = Array.from({ length: 20 }, (_, i) => makeBigPack(`pack-${i}`, 500));
    const { service } = makeService(createMemoryKV(), packs);
    const start = Date.now();
    const draw = service.createDrawer(
      packs.map((p) => p.id),
      seededRng(1),
    );
    const ids = drawN(draw, 10_000);
    const elapsed = Date.now() - start;
    expect(new Set(ids).size).toBe(10_000);
    expect(elapsed).toBeLessThan(5000);
  });
});

describe('history', () => {
  it('markSeen persists across restarts and seenCount reports it', () => {
    const kv = createMemoryKV();
    makeService(kv).service.markSeen('animals:penguin');
    const { service } = makeService(kv);
    expect(service.seenCount('animals')).toBe(1);
    const drawn = drawN(service.createDrawer(['animals'], seededRng(1)), 3);
    expect(drawn).not.toContain('animals:penguin');
  });

  it('resetHistory clears one pack or everything', () => {
    const kv = createMemoryKV();
    const { service } = makeService(kv);
    drawN(service.createDrawer(['animals', 'food-drink'], seededRng(1)), 6);
    const food = service.seenCount('food-drink');
    expect(service.seenCount('animals') + food).toBe(6);
    service.resetHistory('animals');
    expect(service.seenCount('animals')).toBe(0);
    expect(service.seenCount('food-drink')).toBe(food);
    service.resetHistory();
    expect(service.seenCount('food-drink')).toBe(0);
    expect(kv.keys().filter((k) => k.startsWith(KV_KEYS.seenPrefix))).toEqual([]);
    // Survives restart too.
    expect(makeService(kv).service.seenCount('food-drink')).toBe(0);
  });

  it('ignores corrupt history entries', () => {
    const kv = createMemoryKV({ [`${KV_KEYS.seenPrefix}animals`]: '{not json' });
    const { service } = makeService(kv);
    expect(service.seenCount('animals')).toBe(0);
    expect(() => service.createDrawer(['animals'])()).not.toThrow();
  });
});
