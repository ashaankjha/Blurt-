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

- **iOS steppers.** The design-system `Stepper` makes its whole row one accessible "adjustable" element. XCUITest (and so Maestro on iOS) hides the children of an accessible element, so `settings-target-dec` / `setup-target-dec` may not be found on iOS. Android is unaffected. If it bites, `src/ui` can expose the +/- buttons to automation (e.g. keep the row `accessible` only when a screen reader is on), or the flows can tap by coordinates.
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

Options: `BLURT_WEB_DIR=<dir>` reuses an existing E2E export (skips step 1); `HEADED=1` shows the browser; `KEEP_EXPORT=1` keeps the temporary export; `STRICT_NETWORK=1` also fails on the tolerated audio re-reads below.

### Network check

During play the page is offline, the static server must log zero hits, and the page must not try any request, with one tolerated, documented exception on web: expo-audio's `<audio>` elements re-read a bundled sound file they were created with at launch (same origin, `/assets/.../*.wav`, resource type `media`; online Chromium revalidates them with HTTP 304, offline they fail silently and play continues), plus `blob:` URLs (in memory). Native builds read sounds from the app binary, so this is web-only. It would go away if `src/audio` preloaded every sound (not only the buzzers) into expo-audio's cache on web.

One web-only fix is already in place: the root layout prefetches the code-split in-game routes (`round`, `caught`, `scoreboard`, `win`) at launch, because expo-router splits routes on web by default (`asyncRoutes`). Setting `['expo-router', { asyncRoutes: false }]` in `app.config.ts` would make that unnecessary.
