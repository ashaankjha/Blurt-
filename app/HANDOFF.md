# app/ handoff (Agent F, Screens)

All P0 screens are Expo Router routes in `app/`. They are UI only and talk to `useGame`,
`useSettings`, `contentService` and `audioService`. Every one can be reached with the Phase 0
mock store.

This file is safe here: Expo Router only picks up `*.js|jsx|ts|tsx` files from `app/`
(`EXPO_ROUTER_CTX_IGNORE` in `expo-router/_ctx-shared.js`). The web export lists no route for it.

## Routes

| Route          | File              | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`            | `index.tsx`       | Quick Play (calls `quickPlay()`, which starts round 1), Custom Game, How to Play, Settings. On first launch (`hasSeenTutorial` false) it pushes `/how-to-play` once, on mount.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `/setup`       | `setup.tsx`       | TeamCards (2-4), seat-order helper, Shuffle seats, target Stepper, skips Segmented, fuse RangeSlider (seconds), chill-mode toggle, pack summary, and Start (disabled until a pack is selected). On mount it loads the rules from `settings.defaultRules` and the packs from `settings.lastPackIds`, filtered to packs that exist. Team names are kept for the session. Start saves `lastPackIds`. The mode picker is P1 and hidden.                                                                                                                                                                   |
| `/packs`       | `packs.tsx`       | Grid of PackTiles, search by name, tag chips (family, kids, hard, local, plus adult when After Dark is on; a pack matches if it has any selected tag), select all/none (applies to the packs shown), and a sticky footer with the selected count, phrase count and Done.                                                                                                                                                                                                                                                                                                                              |
| `/round`       | `round.tsx`       | Dark scheme with the holder team's color as the tint, "`holderLabel()` is up", PhraseText (hidden while paused), full-width Got it, and a small Skip (hidden when 0 skips are allowed, no count when unlimited, disabled at 0 left). Got it and Skip share a 300 ms button-level debounce. Pause sits top right; long-pressing it (600 ms) opens the host menu: End round (no score), or Quit game (with a confirm step). Opening the menu pauses the round and Cancel resumes it. FuseBar appears only in chill mode (`showFuse`). The screen uses `useKeepAwake` and pauses on AppState background. |
| `/caught`      | `caught.tsx`      | White flash (skipped with reduce motion), tinted with the caught team's color. "`<player> (<team>)` got caught!" when the last roundLog entry has `caughtPlayer`. ScoreRows with `delta={1}` for every scoring team. Continue calls `showScoreboard()`.                                                                                                                                                                                                                                                                                                                                               |
| `/scoreboard`  | `scoreboard.tsx`  | ScoreRows against the target, Next Round, Undo last point (disabled when `roundLog` is empty), and Quit game (confirm).                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `/win`         | `win.tsx`         | Winner (`winnerTeamId`, falling back to the top score), Confetti, final scores, a game-stats card (shown only when there are stats: caught most from roundLog, fastest guess from `stats.fastest`, most guessed from `stats.gotIt`), Play Again, Home, and a small undo.                                                                                                                                                                                                                                                                                                                              |
| `/how-to-play` | `how-to-play.tsx` | 3 pages that you can swipe (horizontal paging ScrollView) or step through with Back/Next, plus Skip. Finishing or skipping sets `hasSeenTutorial`.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `/settings`    | `settings.tsx`    | Sound, volume (25/50/75/100%), haptics, respect silent switch, buzzer chips (Random plus `listBuzzers()`; a tap selects the buzzer and previews it with `playBuzzer`), default rules, After Dark (18+, with a confirm), reset phrase history (confirm), reset all settings (confirm), How to Play, and the version.                                                                                                                                                                                                                                                                                   |
| `/gallery`     | `gallery.tsx`     | Unchanged dev gallery from `src/ui`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

## Navigation model (important for Agent G)

Screens never navigate to in-game routes themselves. `GamePhaseRouter` in `_layout.tsx` maps
`game.phase` to a route:

- `playing`/`paused` → `/round`
- `caught` → `/caught`
- `scoreboard` → `/scoreboard`
- `won` → `/win`
- `game === null` while on an in-game route → home (`dismissAll`)

It pushes when you enter a game from Home or Setup, and replaces when you move between in-game
routes. So `quickPlay()`, `startGame()`, `showScoreboard()`, `nextRound()`, `playAgain()`,
`endRoundNoScore()` and `quitGame()` are all a screen needs to call. The real store only has to
move `phase` correctly. On in-game routes, Android hardware back is swallowed and pauses a
playing round. iOS swipe-back is disabled on those routes (`gestureEnabled: false`). Orientation
is portrait.

`_layout.tsx` also exposes `window.__blurt = { useGame, useSettings }` in dev builds, or when
`EXPO_PUBLIC_E2E_HOOKS=1` is set at export time. This exists for the Playwright web smoke test,
because the mock never blows a fuse. Store builds don't set it.

## Testing

- `npm run typecheck`, `npm run lint` and `npm test` all pass.
- Screen tests with RNTL were skipped: Expo Router turns every `.ts`/`.tsx` under `app/`
  (including `app/__tests__/`) into a route, and this agent may only write to `app/`. Screen
  tests could live in `src/` or `e2e/`, or Maestro could cover these flows.
- Web smoke test: `EXPO_PUBLIC_E2E_HOOKS=1 npx expo export --platform web`, then serve the
  output with `python3 -m http.server` and drive it with Playwright. It covered: tutorial → Home →
  Quick Play → round, a double-tapped Got it advancing once, pause, the host menu via long press,
  End round → scoreboard → Next Round, a fake caught → Continue → scoreboard, a fake won → win →
  Play Again → Quit, Setup (Start disabled with no packs, add a team, pick packs, skips 0 hides
  Skip, chill mode shows the fuse, `lastPackIds` saved), and Settings with the After Dark confirm.
  No console errors.

## Known gaps / requests

- Audio and haptics are not triggered from screens: the buzzer on caught, tick, got-it sfx and
  `audioService.configure`/`preload` are left to the store (Agent G). The only screen call is the
  buzzer preview in Settings.
- The round screen pauses on AppState background. If G moves lifecycle pause into the store, the
  screen listener is harmless (it only pauses while `playing`) and can be deleted.
- No mid-round score display on Round, on purpose: it keeps the screen clean.
- Requests:
  - **Store**: `addTeam` in the mock picks `TEAM_COLORS[teams.length]`, which can clash with a
    color a user already chose. The real store should pick the first unused color.
  - **Store**: `shuffleSeats` is a no-op in the mock. Setup disables it until 2+ player names
    exist.
  - **UI**: `Screen` with `scheme="dark"` should provide the dark theme to its children (via
    context). Round and Caught pass `palette.dark.text` explicitly for text on the team tint, and
    leave Cards, Buttons and ScoreRows to the theme.
  - **UI**: `IconButton` has no `accessibilityHint`, so the long-press hint lives in the
    `accessibilityLabel` ("Pause. Long press for host menu").
  - **UI**: `Segmented`, `Chip` and `ToggleRow` have no `disabled` prop. Volume stays editable
    while sound is off.
