import * as fc from 'fast-check';

import type { Pack } from '../../content/schema';
import { makePack } from './__fixtures__/packs';
import {
  base64UrlDecode,
  base64UrlEncode,
  createCustomPackService,
  decodePack,
  encodePack,
  InvalidPackCodeError,
  rekeyPack,
  SHARE_CODE_PREFIX,
} from './custom';
import { createMemoryKV } from './kv';

const PACK: Pack = {
  ...makePack('family-fun', ['Grandma Rosé', 'Our Dog 🐶', 'Crème Brûlée'], ['custom']),
  emoji: '👨‍👩‍👧',
  description: 'Inside jokes — ñ, 日本, 🎉',
};
PACK.phrases[0] = { ...PACK.phrases[0], difficulty: 2, taboo: ['old', 'mom', 'nana'] };

describe('share codes', () => {
  it('round-trips a pack, including unicode and taboo words', () => {
    const code = encodePack(PACK);
    expect(code.startsWith(SHARE_CODE_PREFIX)).toBe(true);
    expect(code).toMatch(/^B1\.[A-Za-z0-9_-]+$/);
    expect(decodePack(code)).toEqual(PACK);
  });

  it('tolerates whitespace and line breaks from copy/paste', () => {
    const code = encodePack(PACK);
    const messy = `  ${code.slice(0, 20)}\n${code.slice(20, 40)} ${code.slice(40)}\n`;
    expect(decodePack(messy)).toEqual(PACK);
  });

  it('forces the custom tag (keeping adult for 18+ gating)', () => {
    expect(decodePack(encodePack({ ...PACK, tags: ['family', 'kids'] })).tags).toEqual(['custom']);
    expect(decodePack(encodePack({ ...PACK, tags: ['adult'] })).tags).toEqual(['custom', 'adult']);
  });

  it('rejects invalid codes', () => {
    const bad = [
      '',
      'hello',
      encodePack(PACK).slice(3), // missing prefix
      'B1.!!!!',
      'B1.' + base64UrlEncode(new Uint8Array([0xff, 0xfe])), // not UTF-8
      encodePack(PACK).slice(0, -10), // truncated
      'B1.' + base64UrlEncode(new TextEncoder().encode('{"id":"x"}')), // schema fail
      encodePack({ ...PACK, phrases: [{ id: 'family-fun:x', text: 'one two three four five six', difficulty: 1 }] }),
      encodePack({ ...PACK, phrases: [{ id: 'other:x', text: 'X', difficulty: 1 }] }),
      encodePack({ ...PACK, phrases: [] }),
    ];
    for (const code of bad) expect(() => decodePack(code)).toThrow(InvalidPackCodeError);
  });

  it('base64url matches the standard encoding', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 64 }), (bytes) => {
        const ours = base64UrlEncode(bytes);
        expect(ours).toBe(Buffer.from(bytes).toString('base64url'));
        expect([...base64UrlDecode(ours)]).toEqual([...bytes]);
      }),
    );
  });

  it('round-trips arbitrary unicode text', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'grapheme', minLength: 1, maxLength: 10 }), (description) => {
        expect(decodePack(encodePack({ ...PACK, description })).description).toBe(description);
      }),
    );
  });
});

describe('CustomPackService', () => {
  it('saves, lists, updates and removes packs, persisting across instances', () => {
    const kv = createMemoryKV();
    const a = createCustomPackService({ kv });
    a.save(PACK);
    a.save(makePack('second', ['Hello'], ['custom']));
    a.save({ ...PACK, name: 'Renamed' });
    const b = createCustomPackService({ kv });
    expect(b.list().map((p) => [p.id, p.name])).toEqual([
      ['family-fun', 'Renamed'],
      ['second', 'second'],
    ]);
    b.remove('family-fun');
    expect(
      createCustomPackService({ kv })
        .list()
        .map((p) => p.id),
    ).toEqual(['second']);
  });

  it('validates on save, forces the custom tag and rejects reserved ids', () => {
    const svc = createCustomPackService({ kv: createMemoryKV(), reservedIds: () => ['movies'] });
    expect(() => svc.save({ ...PACK, phrases: [] })).toThrow();
    expect(() => svc.save(makePack('movies', ['Jaws'], ['custom']))).toThrow(/reserved/);
    svc.save(rekeyPack(makePack('movies', ['Jaws'], ['family']), 'my-movies'));
    expect(svc.list()[0]).toMatchObject({ id: 'my-movies', tags: ['custom'] });
    expect(svc.list()[0].phrases[0].id).toBe('my-movies:jaws');
  });

  it('exposes encode/decode', () => {
    const svc = createCustomPackService({ kv: createMemoryKV() });
    expect(svc.decode(svc.encode(PACK))).toEqual(PACK);
  });

  it('skips corrupt stored data', () => {
    expect(createCustomPackService({ kv: createMemoryKV({ 'blurt.custom.v1': 'nope' }) }).list()).toEqual([]);
  });
});
