# Game store handoff (Agent G, Integration)

Owned paths: `src/store/game*`, glue in `app/`, `e2e/`. No frozen contract changed. No dependencies added.

## What's here

| File               | What                                                                                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `game.ts`          | `createGameStore(deps)` and the app instance `useGame` (the `GameStore` contract in `gameTypes.ts`).                                                                         |
| `gameDraft.ts`     | Pure draft helpers: `draftFromSettings`, `quickPlaySettings`, `makeNextTeam` (first unused color), `defaultTeams`, `shuffleSeats`, `finalizeSettings`.                       |
| `gameLifecycle.ts` | `installGameLifecycle({ game, settings, audio })`: the app's single AppState listener (pause on background/inactive, plus Android `blur`) and `audioService.configure` sync. |
| `game.test.ts`     | Store tests with fake timers and injected deps (25 tests).                                                                                                                   |

## How it works

- **Deps.** `createGameStore({ now, rng, content, audio, settings, tickMs })`; every field is optional. Defaults: `Date.now()` (read per call, so Jest fake timers apply), `Math.random`, `contentService`, `audioService`, `useSettings`, 100 ms. Tests pass `mulberry32(seed)`, a fake drawer, a jest-mocked AudioService and `createSettingsStore(createMemoryKV())`.
- **Engine.** Every gameplay action is `reduce(game, action, { now, rng, draw })`. `draw` is the current game's drawer from `content.createDrawer(packIds, rng)`. Each new game (start, Quick Play, Play Again) gets a new drawer, so a game never repeats a phrase and the persisted no-repeat history still applies across games. The drawer lives in the store closure, not in state, so `game` stays plain JSON. A `reduce` that throws (only `draw` can throw, when the packs are empty) is logged in dev and ignored.
- **Fuse loop.** It runs only while `phase === 'playing'`. Every `tickMs` (100 ms) it dispatches `TICK` with `now()`, then calls `audio.startTicking(fuseProgress(game, now))`. It also calls `startTicking` once when a round starts or resumes. Any other phase stops the interval and calls `audio.stopTicking()`. The loop lives in the store, so it doesn't depend on which screen is mounted.
- **Sounds and haptics** fire only when the engine really changed state (`next !== prev`; the engine returns the same object for ignored actions):
  - entering `caught` (from a TICK, or a late Got it/Skip): `stopTicking`, `playBuzzer(settings.buzzerId)` and `haptic('caught')`;
  - an accepted Got it: `playSfx('gotIt')` and `haptic('success')`. An accepted Skip: `playSfx('skip')`;
  - `showScoreboard` from caught: `playSfx('point')` for the scoreboard, or `playSfx('win')` for won.
  - A debounced double tap or a skip with none left changes nothing, so it plays nothing.
- **Draft.** It starts from `settings.defaultRules` and `settings.lastPackIds`, with two default teams (Team Blue and Team Orange). `resetDraft` re-reads settings. `addTeam` takes the first `TEAM_COLORS` entry that no team uses and the lowest free `team-N` id, up to 4 teams. `shuffleSeats` shuffles every non-blank player name and deals the names round-robin from a random starting team, so team sizes differ by at most 1.
- **startGame** first normalizes the draft: it trims and drops blank player names, dedupes packs, orders the fuse range and enforces a target of at least 1. It does nothing when there are no packs or fewer than 2 teams. It saves `lastPackIds` and starts round 1.
- **quickPlay** uses two default teams, `[EVERYTHING_MIX_ID]` (family packs only, never adult, even with After Dark on), and the saved default rules. It starts round 1 and leaves the draft alone, so Setup keeps the team names typed this session.
- **playAgain** runs `createGame(game.settings)` with a new drawer and then START_ROUND. **quitGame** stops the loop and ticking, drops the drawer, and sets `game: null`.
- **Lifecycle.** `app/_layout.tsx` calls `installGameLifecycle` once, and it is the only AppState listener (I removed the one on Round). AppState `background`/`inactive`, or Android `blur`, pauses a playing round: the fuse freezes and Round hides the phrase. It never auto-resumes. Audio settings are applied at install and again whenever sound, volume, haptics or silent-mode changes. `audioService.preload()` runs in an effect, off the first-render path.

## app/ glue changes

- `_layout.tsx` installs the lifecycle, preloads audio, and on web prefetches the code-split in-game routes at launch (see Known gaps).
- `round.tsx` drops its AppState listener. Round and Caught use the deep team color as the background tint (`findTeamColor(hex)?.deep`), as the design-system agent asked.
- `index.tsx` and `settings.tsx` captions: Quick Play follows the saved default rules ("first to N" comes from settings), per the integration spec.

## Tests

`npx jest src/store` covers:

- Quick Play reaches `playing` with a phrase.
- The fuse blows: caught, then the buzzer (configured id) and the haptic. The loop stops after caught, and `startTicking` gets called at least every 250 ms with rising progress.
- Pause freezes the fuse and ticking, and resume continues where it stopped.
- Scoring with 2, 3 and 4 teams.
- Undo.
- Play to the target ends `won` exactly at the target, with the win sfx played once.
- Play Again keeps the settings.
- A double tap plays gotIt once, and a late Got it resolves as the catch.
- Skip limit and the skip sfx.
- End round with no score.
- addTeam colors stay unique, including after a remove.
- shuffleSeats is even and random.
- Draft defaults come from settings, and `lastPackIds` is saved.
- Quick Play never draws an adult phrase (real content, After Dark on, 151 draws).
- The lifecycle pauses on background, inactive and Android blur, with no auto-resume.
- The audio settings sync.

E2E: see `e2e/README.md`. The web Playwright run of Quick Play to Win passes and asserts no network during play. The Maestro flows are written but have not been run on a device.

## Known gaps / notes

- **3-4 team games can tie.** Every non-caught team scores, so after a catch at least two teams share the lead. The engine only declares a winner with a single leader at or above the target, so the game goes on until one team pulls ahead. This is correct per the engine, but the scoreboard has no "tie, keep playing" hint.
- **Web only, audio.** expo-audio's `<audio>` elements re-request `sfx-got-it.wav` and `sfx-point.wav` during play (HTTP 304 online, a silent failure offline). The web E2E tolerates and reports this, and `STRICT_NETWORK=1` makes it fail. Fix in `src/audio`: preload every sound into expo-audio's cache on web, not only the buzzers. Native builds read sounds from the binary.
- **Web only, routes.** expo-router code-splits routes on web by default. `_layout.tsx` prefetches round, caught, scoreboard and win at launch. A cleaner fix is `['expo-router', { asyncRoutes: false }]` in `app.config.ts`, which belongs to the orchestrator.
- **Metro cache across worktrees.** `expo export` served a stale Phase 0 `app/` from the shared Metro cache even with `EXPO_ROUTER_APP_ROOT` set. The E2E script uses `--clear`.
- **iOS Maestro and Stepper.** The design-system Stepper row is one accessible element, so XCUITest may hide its `-dec`/`-inc` buttons and the flows that change the target could fail on iOS. Android is unaffected. Details are in `e2e/README.md`.
- Round keeps its own 300 ms button debounce on top of the engine's, so the design-system `debounceMs` prop isn't needed there.
