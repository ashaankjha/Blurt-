/**
 * Phrase drawer for one game (PRD sections 2 and 4).
 *
 * - The pool is the union of the given packs, grouped by normalized text so "Pizza" from two packs
 *   is one phrase. A group is drawn at most once per in-game cycle (never repeats within a game
 *   until the whole pool is used, then a fresh cycle starts).
 * - A group is "fresh" when none of its phrase ids is in the persisted seen history. Draws are
 *   uniform over fresh, unused groups; stale groups are only used when no fresh one is left.
 * - Drawing marks every id in the group seen (they are the same phrase to the players).
 * - When a pack has no fresh, unused phrases left in this game, its history resets (a new cycle
 *   for that pack). Phrases already drawn this game stay marked so they are not re-served early
 *   next game, unless that would leave the pack exhausted again.
 *
 * Draws are O(1) amortized: candidates live in swap-remove buckets; a pack reset costs O(pack).
 */
import type { Pack, Phrase } from '../../content/schema';
import type { SeenHistory } from './history';

interface Group {
  phrase: Phrase;
  /** Every pooled phrase id with this text, aligned with `entryPacks`. */
  ids: string[];
  entryPacks: string[];
  /** Distinct pack ids of the entries. */
  packs: string[];
}

class Bucket {
  items: number[] = [];
  private pos: Int32Array;
  constructor(size: number) {
    this.pos = new Int32Array(size);
  }
  get size() {
    return this.items.length;
  }
  add(k: number) {
    this.pos[k] = this.items.length;
    this.items.push(k);
  }
  remove(k: number) {
    const i = this.pos[k];
    const last = this.items.pop()!;
    if (last !== k) {
      this.items[i] = last;
      this.pos[last] = i;
    }
  }
  clear() {
    this.items.length = 0;
  }
}

const USED = 0;
const FRESH = 1;
const STALE = 2;

export function buildDrawer(
  packs: Pack[],
  keysOf: (pack: Pack) => string[],
  history: SeenHistory,
  rng: () => number = Math.random,
): () => Phrase {
  const groups: Group[] = [];
  const byKey = new Map<string, number>();
  const seenIds = new Set<string>();
  const packGroups = new Map<string, number[]>();
  const packSize = new Map<string, number>();

  for (const pack of packs) {
    const keys = keysOf(pack);
    const mine: number[] = [];
    let size = 0;
    pack.phrases.forEach((phrase, i) => {
      if (seenIds.has(phrase.id)) return;
      seenIds.add(phrase.id);
      size++;
      let k = byKey.get(keys[i]);
      if (k === undefined) {
        k = groups.length;
        byKey.set(keys[i], k);
        groups.push({ phrase, ids: [], entryPacks: [], packs: [] });
      }
      const g = groups[k];
      g.ids.push(phrase.id);
      g.entryPacks.push(pack.id);
      if (!g.packs.includes(pack.id)) {
        g.packs.push(pack.id);
        mine.push(k);
      }
    });
    if (size > 0) {
      packGroups.set(pack.id, mine);
      packSize.set(pack.id, size);
    }
  }

  const n = groups.length;
  if (n === 0) throw new Error('No phrases in the selected packs');

  const state = new Uint8Array(n);
  const fresh = new Bucket(n);
  const stale = new Bucket(n);
  const freshCount = new Map<string, number>();
  /** Ids drawn in the current in-game cycle, per pack. */
  const drawn = new Map<string, Set<string>>();
  let lastKey = -1;

  const isFresh = (k: number) => groups[k].ids.every((id) => !history.has(id));
  const drawnIn = (packId: string) => {
    let s = drawn.get(packId);
    if (!s) drawn.set(packId, (s = new Set()));
    return s;
  };

  function resetPack(packId: string) {
    let keep: Set<string> = drawnIn(packId);
    if (keep.size >= (packSize.get(packId) ?? 0)) {
      // Everything was drawn this game: keep only the latest draw so it cannot come straight back.
      const last =
        lastKey >= 0 ? groups[lastKey].ids.find((id, i) => groups[lastKey].entryPacks[i] === packId) : undefined;
      keep = new Set(last ? [last] : []);
    }
    history.replace(packId, keep);
    for (const k of packGroups.get(packId) ?? []) {
      if (state[k] === STALE && isFresh(k)) {
        stale.remove(k);
        fresh.add(k);
        state[k] = FRESH;
        for (const q of groups[k].packs) freshCount.set(q, (freshCount.get(q) ?? 0) + 1);
      }
    }
  }

  /** (Re)classify every group from history; `exclude` stays used (the draw that ended the cycle). */
  function startCycle(exclude: number) {
    fresh.clear();
    stale.clear();
    drawn.clear();
    for (const p of packGroups.keys()) freshCount.set(p, 0);
    for (let k = 0; k < n; k++) {
      if (k === exclude) {
        state[k] = USED;
        groups[k].ids.forEach((id, i) => drawnIn(groups[k].entryPacks[i]).add(id));
      } else if (isFresh(k)) {
        state[k] = FRESH;
        fresh.add(k);
        for (const q of groups[k].packs) freshCount.set(q, freshCount.get(q)! + 1);
      } else {
        state[k] = STALE;
        stale.add(k);
      }
    }
    for (const [p, c] of freshCount) if (c === 0) resetPack(p);
  }

  startCycle(-1);

  return function draw(): Phrase {
    if (fresh.size + stale.size === 0) startCycle(n > 1 ? lastKey : -1);
    const bucket = fresh.size > 0 ? fresh : stale;
    const k = bucket.items[Math.min(bucket.size - 1, Math.floor(rng() * bucket.size))];
    bucket.remove(k);
    const wasFresh = state[k] === FRESH;
    state[k] = USED;
    lastKey = k;

    const g = groups[k];
    g.ids.forEach((id, i) => {
      history.add(id);
      drawnIn(g.entryPacks[i]).add(id);
    });
    if (wasFresh) {
      for (const q of g.packs) {
        const c = freshCount.get(q)! - 1;
        freshCount.set(q, c);
        if (c === 0) resetPack(q);
      }
    }
    return g.phrase;
  };
}
