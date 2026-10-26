# Blurt! — agent guide

Offline pass-the-phone party word game. Expo SDK 58, React Native 0.88, TypeScript strict.
The product spec is `docs/PRD.md`; read it before changing behavior.

## Layout and ownership

| Path | What | Rule |
| --- | --- | --- |
| `app/` | Expo Router screens (UI only) | No game logic; talk to `src/store/*` |
| `src/engine/` | Pure TS reducer: rules, fuse, scoring, draw | **No React/Expo/zustand imports** (lint-enforced). Deterministic: time and RNG are injected |
| `src/store/` | Zustand stores (`game.ts` wraps engine, `settings.ts`) | |
| `src/audio/` | AudioService (expo-audio, expo-haptics) | |
| `src/content/` | Pack loader, no-repeat history, custom packs | |
| `src/ui/` | Design system + `tokens.ts` | |
| `src/config.ts` | `APP_NAME` and defaults | The app name lives only here |
| `content/schema.ts` | Zod pack/phrase schema | Shared by app and scripts |
| `content/packs/` | Generated pack JSON + `manifest.json` + `index.ts` | Never hand-edit; run the build |
| `scripts/gen-packs/` | Phrase sources (`sources/<id>.txt`) and build/validate scripts | |

## Frozen contracts

`content/schema.ts`, `src/engine/types.ts`, `src/content/types.ts`, `src/audio/types.ts`,
`src/store/settingsTypes.ts`, `src/store/gameTypes.ts`. Change them only with the orchestrator's
approval; implementations may change freely behind them.

## Commands

```bash
npm run typecheck          # tsc --noEmit
npm run lint               # expo lint
npm test                   # jest (jest-expo preset); tests are co-located *.test.ts(x)
npm run content:validate   # Zod + launch thresholds over content/packs
npx tsx scripts/gen-packs/build.ts [packId]   # sources/*.txt -> content/packs/*.json
npx expo install <pkg>     # always use instead of npm install for runtime deps
```

Run typecheck, lint and tests before declaring work done.

## Expo has changed — do not trust training data

Before using an Expo or React Native API, check the installed version's docs
(`https://docs.expo.dev/versions/v58.0.0/`) or the package's `.d.ts` in `node_modules`.
Native folders (`ios/`, `android/`) are generated; configure via `app.config.ts`.
Device testing needs development builds (`eas build --profile development`), not Expo Go.
