# Engine handoff (Agent A)

## What's here

| File             | Purpose                                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| `types.ts`       | Frozen contract (unchanged).                                                                              |
| `rules.ts`       | `createGame`, `reduce`, `rollFuseDurationMs`, `currentPlayer`. The whole state machine.                   |
| `rng.ts`         | `mulberry32(seed)`: seeded PRNG returning uniform floats in `[0, 1)`.                                     |
| `index.ts`       | Public API: re-exports the above plus `fuseProgress`, `fuseRemainingMs`, `holderLabel`, and every type.   |
| `testHelpers.ts` | Test-only fixtures (`makeSettings`, `makeTeams`, `makeDeps`, `deepFreeze`). Not exported from `index.ts`. |
| `*.test.ts`      | Unit tests plus fast-check property tests (`properties.test.ts`).                                         |

No dependencies added. No React, Expo or zustand imports.

## How to use it (store / Agent G)

```ts
import { createGame, reduce, fuseProgress, fuseRemainingMs, holderLabel, mulberry32 } from '../engine';

const deps = { now: Date.now, rng: mulberry32(Date.now()), draw: contentDrawer }; // drawer from ContentService
let game = createGame(settings); // phase 'setup'
game = reduce(game, { type: 'START_ROUND' }, deps); // 'playing'
// on a ~100-250 ms interval while playing:
const next = reduce(game, { type: 'TICK', now: Date.now() }, deps);
if (next !== game) game = next; // identity is preserved when nothing changed
audio.startTicking(fuseProgress(game, Date.now()));
```

- `reduce` is pure and never mutates its input. Any action that is invalid in the current phase
  returns the **same object**, so `next === game` means "no-op" (cheap for React/zustand).
- `deps.now()` is read for START_ROUND, NEXT_ROUND, GOT_IT, SKIP, PAUSE, RESUME. TICK uses
  `action.now` only. `deps.rng()` is read once per round start. `deps.draw()` is called on
  START_ROUND, NEXT_ROUND, accepted GOT_IT and accepted SKIP, and nowhere else (so the drawer can
  `markSeen` inside `draw` safely).
- Phase flow: `setup -START_ROUND-> playing <-PAUSE/RESUME-> paused`; `playing -TICK past fuse->
caught -SHOW_SCOREBOARD-> scoreboard | won`; `scoreboard -NEXT_ROUND-> playing`;
  `playing|paused -END_ROUND_NO_SCORE-> scoreboard`; `caught|scoreboard|won -UNDO_LAST_POINT-> scoreboard`.
- GOT_IT/SKIP share a 300 ms debounce (`LIMITS.advanceDebounceMs`). If either arrives after the
  fuse already blew (late tap before the next TICK), it resolves as the catch instead.
- Fuse length: `round(min + rng() * (max - min))`, integer ms in `[min, max]` inclusive (a reversed
  range is tolerated). The tick-tempo jitter that hides the fuse is the audio service's job.
- `fuseProgress`: playing = elapsed/duration (clamped), paused = frozen value, caught = 1, else 0.
  `fuseRemainingMs`: playing = ms left (>= 0), paused = frozen ms left, else null. Show it only
  when `settings.showFuse`.
- `holderLabel(state)`: holder team's current player (`players[cursor % players.length]`), or the
  team name when no players were entered. `roundLog[i].caughtPlayer` and `stats.fastest.player`
  use the same rule.
- Seating: GOT_IT advances the passing team's `playerCursor` and moves to the next team.
  NEXT_ROUND moves the phone one seat on from whoever held it last (next team; that team's cursor
  advances by 1).
- Play Again: call `createGame(game.settings)` then START_ROUND.
- Persisting a game mid-round: everything is plain JSON. On restore, PAUSE was presumably
  dispatched on backgrounding, so `fuseEndsAt` is null and `pausedRemainingMs` holds the rest.

## Tests

`npx jest src/engine --coverage --collectCoverageFrom='src/engine/**/*.ts'`: 100% lines and
statements, ~96% branches (the uncovered branches are defensive `?? 0` fallbacks).

Property tests (fast-check): scoring invariant for 2/3/4 teams; no double-advance within 300 ms;
fuse duration in range and varied over 10,000 seeded runs (PRD 9), plus arbitrary ranges; first
`won` in a 2-team game lands exactly on `targetScore`; undo restores pre-catch scores exactly;
deep-frozen inputs are never mutated.

## Known gaps / decisions for the orchestrator

- **UNDO_LAST_POINT from `caught` goes to `scoreboard`** (per the task spec). The state-diagram
  comment in `types.ts` says "(stays caught if in caught)". The comment is in a frozen file, so I
  left it; please reconcile it (suggest editing the comment to match: always `scoreboard`).
- When the round ends (caught or END_ROUND_NO_SCORE), `fuseDurationMs`, `fuseEndsAt`,
  `pausedRemainingMs` and `phraseShownAt` are cleared; `currentPhrase` is kept so the Caught
  screen can show what was being described. NEXT_ROUND replaces it.
- PAUSE does not check whether the fuse already blew; a pause past the deadline freezes at 0 ms
  and the catch happens on the first TICK after RESUME (`at` is the resume-time tick).
- Repeated UNDO walks back through earlier rounds' log entries; the holder/seat position is not
  rewound (only scores, log and winner).
- `stats` is append-only and not rewound by UNDO (undo only affects points).
- Modes (taboo/charades/one-word) need no engine rules beyond the classic loop; the UI handles
  them.
