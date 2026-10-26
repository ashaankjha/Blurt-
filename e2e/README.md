# End-to-end tests

Two layers:

| What                                                   | Where                           | Runs on                                                       |
| ------------------------------------------------------ | ------------------------------- | ------------------------------------------------------------- |
| Maestro flows (the PRD's E2E gate)                     | `e2e/*.yaml`, `e2e/subflows/`   | iOS and Android **development builds**                        |
| Playwright web E2E (Quick Play to Win + offline check) | `e2e/web/quick-play-to-win.mjs` | Headless Chromium against a web export; runs in CI/containers |

Both drive the real UI through the `testID`s in `app/` (on web they become `data-testid`).

## Maestro (iOS / Android)

| Flow                     | Covers                                                                                                                                                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `quick-play-to-win.yaml` | Cold launch, skip tutorial, Settings: Points to win 7 to 1, Quick Play, pause hides the phrase, Got it x3, the fuse blows, Caught, Win, Play Again (round 1), host menu (long press) Quit, Home                              |
| `setup-custom-game.yaml` | Custom Game: rename a team, add players, add a 3rd team, shuffle seats, target 1, 0 skips (no Skip button), shortest fuse, chill mode (visible fuse), pack search and pick, Start, play until a single team leads, Win, Home |
| `settings.yaml`          | Sound, volume, haptics toggles, buzzer select and preview, default rules (Home caption follows them), After Dark 18+ confirmation and adult packs in the picker, Reset all settings                                          |

`subflows/launch-fresh.yaml` launches with `clearState: true` (fresh install, so the tutorial shows) and skips the tutorial when it appears. `subflows/play-round.yaml` taps Got it a few times and then waits up to 120 s for the hidden fuse to blow.

Run them against a development build (not Expo Go: audio, haptics and keep-awake differ):

```bash
# 1. Install Maestro: https://maestro.mobile.dev  (curl -Ls "https://get.maestro.mobile.dev" | bash)
# 2. Build and install a dev build on a simulator/emulator or a device
eas build --profile development --platform android   # or ios; or locally:
npx expo run:android                                  # npx expo run:ios
# 3. Start Metro for the dev build, open the app once so it loads the bundle
npx expo start --dev-client
# 4. Run the flows (appId com.ashaankjha.blurt, from src/config.ts APP_BUNDLE_ID)
maestro test e2e/quick-play-to-win.yaml
maestro test e2e/                                     # every flow in the folder (subflows are run by them)
```

A release build (`eas build --profile preview`) runs the same flows without Metro. Quick Play to Win takes about 1-2 minutes (one fuse of 45-75 s); the custom-game flow uses the 15 s fuse.

Notes and known risks (the flows were written by reading the screens; they have not been run on a device yet):

- **Steppers.** The design-system `Stepper` exposes `<id>-dec`, `<id>-inc` and `<id>-value` as their own accessible elements, outside the adjustable `<id>` element (the label, which takes VoiceOver/TalkBack increment/decrement). XCUITest hides the children of an accessible element, so this layout keeps the buttons reachable by Maestro on iOS. `src/ui/components.test.tsx` checks that no Stepper control sits inside an accessible element.
- The fuse-range swipes in `setup-custom-game.yaml` are `optional`: if the slider thumbs don't move, the round still ends within 75 s.
- Native alerts: button text is matched case-insensitively (`(?i)reset`) because Android renders buttons in caps.

## Web E2E (Playwright)

```bash
node e2e/web/quick-play-to-win.mjs
```

What it does:

1. Exports the web build with the E2E hooks: `EXPO_PUBLIC_E2E_HOOKS=1 EXPO_ROUTER_APP_ROOT=$PWD/app npx expo export --clear --platform web --output-dir <tmp>`.
   - `EXPO_ROUTER_APP_ROOT=$PWD/app` is required when running from a git worktree: without it the export can silently bundle another checkout's `app/`.
   - `--clear` is required too: Metro's transform cache is shared across checkouts, and a stale cache served a Phase 0 `app/` (only `index` and `gallery` routes) even with `EXPO_ROUTER_APP_ROOT` set.
2. Serves it with `python3 -m http.server` on a free port (starting at `/`; `http.server` has no SPA fallback, so the test only navigates inside the app).
3. In Chromium (390x844): cold launch, skip the tutorial, set Points to win 7 to 2 with the real Settings stepper, then **switches the browser offline** (airplane mode) and records every request. Then: Quick Play, pause (phrase hidden, fuse frozen past its full length), resume, Got it with a double click (advances exactly once), Skip, rounds until a team wins exactly at the target, Play Again (same settings, round 1, scores 0), host menu (long press) Quit, Home.
4. Asserts no page errors and no network during play (below).

The only use of the `window.__blurt` hooks: shortening the fuse to 2-3 s (the UI floor is 15 s) and reading state for assertions. Every catch comes from the real store fuse loop; no phase is faked.

Options: `BLURT_WEB_DIR=<dir>` reuses an existing E2E export (skips step 1); `HEADED=1` shows the browser; `KEEP_EXPORT=1` keeps the temporary export; `STRICT_NETWORK=1` also fails on any re-read of a bundled sound file (see below); CI and QA run with it.

### Network check

During play the page is offline, the static server must log zero hits, and the page must not try any network request. `blob:` (and `data:`) URLs are in memory and always allowed: on web, `src/audio` preloads every sound (ticks, sfx and buzzers) into expo-audio's blob cache at launch and then re-points each player at its cached copy, so replays never go back to the server. Without `STRICT_NETWORK=1` the script still tolerates (and reports) an `<audio>` element re-reading a bundled `/assets/.../*.wav|m4a` file, which is what happened before that fix; with it, any such request fails the run. Native builds read sounds from the app binary.

One web-only fix is already in place: the root layout prefetches the code-split in-game routes (`round`, `caught`, `scoreboard`, `win`) at launch, because expo-router splits routes on web by default (`asyncRoutes`). Setting `['expo-router', { asyncRoutes: false }]` in `app.config.ts` would make that unnecessary.
