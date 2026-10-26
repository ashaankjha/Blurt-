/**
 * Custom packs (PRD F12, P1 stub). Packs are stored as one JSON array in kv; share codes are
 * `B1.` + base64url(UTF-8 minified JSON). The `B1` prefix leaves room for a compressed `B2`
 * format later without breaking codes already shared.
 */
import { PackSchema, type Pack, type PackTag } from '../../content/schema';
import { KV_KEYS, type KV } from './kv';
import type { CustomPackService } from './types';

export const SHARE_CODE_PREFIX = 'B1.';
/** Generous ceiling (a 2,000-phrase pack is ~150 KB of code); guards against pasting garbage. */
const MAX_CODE_LENGTH = 512_000;

export class InvalidPackCodeError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'InvalidPackCodeError';
  }
}

// --- UTF-8 + base64url (pure TS: no reliance on TextEncoder/btoa being present) ---------------

function utf8Encode(text: string): Uint8Array {
  const out: number[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }
  return Uint8Array.from(out);
}

function utf8Decode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length;) {
    const b = bytes[i];
    let cp: number;
    let len: number;
    if (b < 0x80) [cp, len] = [b, 1];
    else if (b >= 0xc2 && b < 0xe0) [cp, len] = [b & 31, 2];
    else if (b >= 0xe0 && b < 0xf0) [cp, len] = [b & 15, 3];
    else if (b >= 0xf0 && b < 0xf5) [cp, len] = [b & 7, 4];
    else throw new Error('invalid UTF-8');
    if (i + len > bytes.length) throw new Error('truncated UTF-8');
    for (let j = 1; j < len; j++) {
      const c = bytes[i + j];
      if ((c & 0xc0) !== 0x80) throw new Error('invalid UTF-8');
      cp = (cp << 6) | (c & 63);
    }
    out += String.fromCodePoint(cp);
    i += len;
  }
  return out;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64_INDEX: Record<string, number> = Object.fromEntries([...B64].map((c, i) => [c, i]));

export function base64UrlEncode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b = 0, c = 0] = [bytes[i], bytes[i + 1], bytes[i + 2]];
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += B64[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += B64[n & 63];
  }
  return out;
}

export function base64UrlDecode(input: string): Uint8Array {
  const code = input.replace(/=+$/, '');
  if (code.length % 4 === 1) throw new Error('invalid base64url length');
  const out = new Uint8Array(Math.floor((code.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < code.length; i += 4) {
    let n = 0;
    const chunk = code.slice(i, i + 4);
    for (let j = 0; j < 4; j++) {
      const v = j < chunk.length ? B64_INDEX[chunk[j]] : 0;
      if (v === undefined) throw new Error(`invalid base64url character "${chunk[j]}"`);
      n = (n << 6) | v;
    }
    out[o++] = (n >> 16) & 255;
    if (chunk.length > 2) out[o++] = (n >> 8) & 255;
    if (chunk.length > 3) out[o++] = n & 255;
  }
  return out.subarray(0, o);
}

// --- Pack helpers -----------------------------------------------------------------------------

/** Custom packs always carry 'custom'; 'adult' is kept so 18+ gating still applies. */
function customTags(tags: readonly PackTag[]): PackTag[] {
  return tags.includes('adult') ? ['custom', 'adult'] : ['custom'];
}

/** Gives a pack a new id, rewriting phrase ids to `${id}:${slug}` (e.g. to resolve a collision). */
export function rekeyPack(pack: Pack, id: string): Pack {
  return {
    ...pack,
    id,
    phrases: pack.phrases.map((p) => ({ ...p, id: `${id}:${p.id.slice(p.id.indexOf(':') + 1)}` })),
  };
}

export function encodePack(pack: Pack): string {
  return SHARE_CODE_PREFIX + base64UrlEncode(utf8Encode(JSON.stringify(pack)));
}

/** Parses and Zod-validates a share code; throws InvalidPackCodeError. Forces the 'custom' tag. */
export function decodePack(code: string): Pack {
  const trimmed = code.replace(/\s+/g, '');
  if (!trimmed.startsWith(SHARE_CODE_PREFIX)) throw new InvalidPackCodeError('Not a pack code');
  if (trimmed.length > MAX_CODE_LENGTH) throw new InvalidPackCodeError('Pack code is too long');
  let raw: unknown;
  try {
    raw = JSON.parse(utf8Decode(base64UrlDecode(trimmed.slice(SHARE_CODE_PREFIX.length))));
  } catch (e) {
    throw new InvalidPackCodeError('Pack code is damaged', e);
  }
  const res = PackSchema.safeParse(raw);
  if (!res.success) {
    const first = res.error.issues[0];
    throw new InvalidPackCodeError(`Invalid pack: ${first.path.join('.')} ${first.message}`.trim(), res.error);
  }
  return { ...res.data, tags: customTags(res.data.tags) };
}

export interface CustomPackServiceOptions {
  kv: KV;
  /** Ids that custom packs may not use (bundled packs, the virtual mix). */
  reservedIds?: () => Iterable<string>;
}

export function createCustomPackService({ kv, reservedIds }: CustomPackServiceOptions): CustomPackService {
  let cache: Pack[] | null = null;

  function load(): Pack[] {
    if (cache) return cache;
    cache = [];
    const raw = kv.get(KV_KEYS.customPacks);
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            const res = PackSchema.safeParse(item);
            if (res.success) cache.push(res.data);
          }
        }
      } catch {
        // Corrupt entry: start empty rather than crash.
      }
    }
    return cache;
  }

  function persist(packs: Pack[]) {
    cache = packs;
    if (packs.length === 0) kv.remove(KV_KEYS.customPacks);
    else kv.set(KV_KEYS.customPacks, JSON.stringify(packs));
  }

  return {
    list: () => [...load()],
    save(pack) {
      const res = PackSchema.safeParse(pack);
      if (!res.success) {
        const first = res.error.issues[0];
        throw new Error(`Invalid pack: ${first.path.join('.')} ${first.message}`.trim());
      }
      for (const id of reservedIds?.() ?? []) {
        if (id === pack.id) throw new Error(`Pack id "${pack.id}" is reserved; rename it with rekeyPack()`);
      }
      const clean: Pack = { ...res.data, tags: customTags(res.data.tags) };
      const packs = load();
      const i = packs.findIndex((p) => p.id === clean.id);
      persist(i < 0 ? [...packs, clean] : packs.map((p, j) => (j === i ? clean : p)));
    },
    remove(id) {
      persist(load().filter((p) => p.id !== id));
    },
    encode: encodePack,
    decode: decodePack,
  };
}
