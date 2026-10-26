# Content runtime handoff (Agent B)

Owned paths: `src/content/`, `src/store/settings*`. No frozen contract changed. No new dependencies.

## What is here

| File                    | What                                                                                                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kv.ts`                 | Sync KV interface over `expo-sqlite/kv-store` (`kv`), plus `createMemoryKV()` for tests. Storage errors are swallowed (logged in dev). All keys live under `KV_KEYS` (`blurt.*`). |
| `history.ts`            | `SeenHistory`: per-pack seen ids, one kv entry per pack (`blurt.seen.v1.<packId>`), lazy-loaded, written through on every change.                                                 |
| `drawer.ts`             | `buildDrawer`: the per-game draw function (algorithm below).                                                                                                                      |
| `service.ts`            | `createContentService({ manifest, loaders, kv, customPacks? })`: the real `ContentService`.                                                                                       |
| `custom.ts`             | `createCustomPackService({ kv, reservedIds? })`, `encodePack` / `decodePack` share codes, `rekeyPack`, `InvalidPackCodeError`.                                                    |
| `index.ts`              | App instances: `contentService`, `customPackService` (built from `content/packs/index.ts`), and re-exports of the above.                                                          |
| `jest.setup.ts`         | Global Jest mock of `expo-sqlite/kv-store` (in-memory, same sync + async surface). Fresh per test file; `Storage.clearSync()` wipes it.                                           |
| `__fixtures__/packs.ts` | Test fixtures (`makePack`, `makeBigPack`, `fixtureDeps`, `seededRng`). Not used by app code.                                                                                      |
| `../store/settings.ts`  | `useSettings` (zustand + `persist`), `DEFAULT_SETTINGS`, `createSettingsStore(kv)`, `sanitizeSettings`.                                                                           |

## How to use

```ts
import { contentService } from '@/src/content'; // or relative path

contentService.listPacks({ includeAdult: settings.afterDarkEnabled }); // mix first, then bundled, then custom
const draw = contentService.createDrawer(packIds, rng); // one per game; pass to engine deps.draw
contentService.resetHistory(); // Settings > Reset history
contentService.seenCount('movies');
```

- **Quick Play**: `createDrawer(['everything-mix'])`. The mix is every bundled pack tagged `family` and not `adult`, so After Dark is never in Quick Play.
- **Drawer semantics** (PRD 2 and 4):
  - The pool is the union of the selected packs (the mix expands to its family packs; ids are deduped). Phrases with the same `normalizePhraseKey` text are one entry, so "Pizza" from Food and Kids cannot both show up in one game.
  - No repeats within a game. If a game uses the whole pool, a new in-game cycle starts (the phrase that ended the last cycle sits that cycle out, so there is no back-to-back repeat). It throws only when the selection has zero phrases.
  - Across games, draws are uniform over phrases not in the persisted history. Drawing marks every pack's copy of that text seen, and every draw is persisted at once, so history survives an app restart.
  - When a pack has no unseen phrases left in the pool, **that pack's** history resets. Phrases already drawn this game stay marked, so they don't come straight back next game. If the game drew the entire pack, only the latest draw is kept.
  - Cost: O(1) amortized per draw (swap-remove buckets). A reset is O(pack size). Building a drawer is O(pool), and normalized keys are cached per pack. 10k phrases and 10k draws run in well under a second in Jest.
- **Settings**: `useSettings` hydrates synchronously at import, so the first render already has persisted values. Persisted JSON is `{ state, version: 1 }` under `blurt.settings`. On load the data is sanitized and merged over defaults: unknown keys are dropped, mistyped values fall back, and new keys get their defaults. `resetAll()` restores and persists the defaults and does not touch phrase history. Tests can call `createSettingsStore(createMemoryKV())`.
- **Custom packs (P1 stub)**: `customPackService.save(pack)` validates with `PackSchema`, forces `tags: ['custom']` (it keeps `'adult'` so 18+ gating still works), and refuses bundled ids and `everything-mix` (use `rekeyPack(pack, newId)`). Share codes are `B1.` + base64url(UTF-8 JSON), via a pure-TS codec with no `btoa` or `TextEncoder` dependency. `decode` trims whitespace, Zod-validates, and throws `InvalidPackCodeError`. Custom packs show up in `listPacks`, `getPack` and `createDrawer`.

## Known gaps / notes for integration

- `content/packs/manifest.json` is empty until Agent C's packs merge, so until then `contentService.listPacks()` returns only Everything Mix with 0 phrases and `createDrawer(['everything-mix'])` throws. Screens built on the old stub's two packs will see no packs until C merges.
- The first `listPacks()` after install (or after a pack version changes) parses every family pack once to compute the mix's distinct phrase count. The count is then cached in kv, keyed by family pack ids and versions, so later cold starts parse nothing. `getPack('everything-mix')` and drawing from the mix always load the family packs.
- Bundled packs are not Zod-validated at runtime (CI does that). Custom packs are.
- Share codes are not compressed yet (`B1`). A future `B2` can add compression, and `decode` dispatches on the prefix.
- Removing a custom pack leaves its seen history in kv. This is harmless, and the history comes back if a pack with the same id is re-imported.
- A drawer snapshots freshness when it is created. `markSeen` calls made outside the drawer during the same game don't change that game's candidate buckets.
- The `expo-sqlite/kv-store` on web needs SQLite wasm. Native iOS and Android are the targets.
