# Blurt! — Product Requirements Document

Oct 26, 2026 · @Ashaank Jha

## 1. Overview

Blurt! is a free, offline, pass-the-phone party word game: describe the phrase, get your team to shout it, pass the phone before the hidden fuse blows. It is a ground-up remake of Phrase Frenzy (Brain Rice Games) with every pack free, better team handling, and modern design.

**Why rebuild it.** Phrase Frenzy has a great core loop but a dated UI, a $1.99 paywall plus in-app purchases for packs, rigid alternating teams, and a 3.7-star rating. Blurt! keeps the loop and fixes the rest.

**Name.** Primary: **Blurt!** (what players do when they guess). Backups if the name is taken on the stores: *Hot Phrase*, *Fuse*, *Pass It!*, *Kaboom Clues*. The coding agent must put the app name in one config constant so a rename is a one-line change.

### Goals

1. Ship a polished iOS + Android app playable fully offline, with zero network calls during play.
2. Launch with at least 30 packs and 10,000 unique phrases, every pack unlocked and free.
3. A new group goes from app open to first round in under 30 seconds.
4. No ads, no accounts, no data collection.

### Non-goals (v1)

- Online/remote multiplayer, video chat, or accounts.
- Monetization beyond an optional, non-gating tip jar (fast-follow, may be cut).
- Leaderboards or social features.

## 2. Core gameplay

The loop: players sit in a circle with teams alternating seats, one phone is the "hot potato," and whoever holds it when the fuse blows gives the other team a point.

### Classic round

1. Host picks teams (2–4) and one or more packs.
2. Round starts; a hidden fuse timer runs for a random duration (default 45–75 s).
3. Holder sees a phrase and describes it without saying any word in it, rhyming, or spelling.
4. When their team guesses, holder taps **Got it** and passes the phone to the next player (an opponent). The next phrase appears.
5. A tick sound and haptic pulse accelerate as the fuse nears zero. The timer itself is never shown.
6. Fuse blows: a random buzzer plays, the phone shows who got caught. Every team except the caught team scores 1 point (2-team game: the other team scores).
7. First team to the target score (default 7) wins.

### Improvements over Phrase Frenzy

| Area | Phrase Frenzy | Blurt! |
| --- | --- | --- |
| Packs | Paid app + paid packs | Every pack free, forever |
| Teams | 2 teams, alternating count-off | 2–4 teams, named players, random or manual seating, seat-order helper |
| Scoring | Manual on paper | Built-in scoreboard, target score, undo last point |
| Skips | Not limited | Configurable skips per turn (0, 1, 3, unlimited) |
| Repeats | No-repeat per category | No-repeat across sessions, persisted on device |
| Custom content | None | Make your own packs; share via QR/code, offline |
| Modes | Classic only | Classic + 3 variants (section 3) |
| Fuse | Hidden only | Hidden (default) or visible "chill mode" for kids |

### Rules engine requirements

- Fuse duration is random within a configurable min/max and must not be guessable from the tick tempo alone (add jitter).
- Pausing (app backgrounded, phone call, pause button) freezes the fuse and hides the phrase.
- A round can end early via a host-only long-press menu (end round, no score).
- Phrases drawn within a game never repeat; the on-device "seen" history resets per pack when exhausted.

## 3. Feature requirements

P0 ships in v1.0; P1 is fast-follow and should be built only after all P0 acceptance tests pass.

| ID | Feature | Priority | Notes |
| --- | --- | --- | --- |
| F1 | Quick Play | P0 | One tap: 2 teams, all family-safe packs, default settings |
| F2 | Game setup | P0 | Teams (2–4), team names/colors, optional player names, target score, skips, fuse range |
| F3 | Pack picker | P0 | Grid of packs, multi-select, search, filter by tag (family, adult, hard), phrase count per pack |
| F4 | Classic round | P0 | Full rules in section 2 |
| F5 | Fuse audio + haptics | P0 | Accelerating tick, 30+ buzzer sounds, random-buzzer option, volume and haptics toggles |
| F6 | Scoreboard | P0 | Between rounds; undo last point; win screen with confetti |
| F7 | No-repeat history | P0 | Persisted per pack; reset button in settings |
| F8 | Offline content | P0 | All packs bundled in the binary; no network permission needed |
| F9 | Settings | P0 | Sound, haptics, buzzer, default rules, "After Dark" (18+) packs toggle, reset history |
| F10 | How to play | P0 | 3-screen illustrated tutorial, skippable, shown on first launch |
| F11 | Accessibility | P0 | Dynamic type, VoiceOver/TalkBack labels, color-blind-safe team colors, reduce-motion |
| F12 | Custom packs | P1 | Create/edit/delete packs on device; paste a list; share via QR code or text code (compressed JSON) |
| F13 | Taboo mode | P1 | Phrase shows 3 forbidden words; opponents can tap "Buzz" to skip |
| F14 | Charades mode | P1 | Act it out, no talking; same fuse |
| F15 | One-Word mode | P1 | Holder may say only one word per clue |
| F16 | Game stats | P1 | Who got caught most, fastest guess, shown at game end |
| F17 | Localization | P1 | i18n scaffolding in v1; Spanish + French content in P1 |
| F18 | Tip jar | P1 | Optional; never gates content |

**Content policy.** Adult ("After Dark") packs are free but hidden until the 18+ toggle is enabled in settings. They are excluded from Quick Play.

## 4. Content

Launch target: 30+ packs, 10,000+ unique phrases, every one free. Content quality matters more than count: each phrase must be describable, widely known, and fun to shout.

### Launch packs

| Group | Packs (approx. phrases each) |
| --- | --- |
| Everyday | Everything Mix (all family packs), Household (400), Food & Drink (500), Animals (400), Jobs (300), Places (400), Verbs & Actions (400) |
| Pop culture | Movies (500), TV Shows (400), Music Artists (400), Songs Title Only (300), Video Games (300), Internet & Memes (300), Celebrities (400) |
| Brainy | Science (300), History (300), Geography (300), Idioms & Sayings (400), Famous Phrases (300) |
| Fun | Sports (400), Holidays (250), Fantasy & Myth (250), Brands (400), 90s & 2000s Nostalgia (300), Kids (500, easy) |
| Local | NYC (200), Road Trip USA (250) |
| After Dark (18+) | Party (300), Awkward Situations (250), Dating (250) |

### Phrase rules

- 1–5 words, max 32 characters, no proper nouns that are obscure outside the US unless the pack is US-themed.
- Each phrase carries a difficulty (1 easy, 2 medium, 3 hard) and optional taboo words (3, for Taboo mode).
- No slurs, real-person sexual content, or tragedy references. Celebrity packs use only very well-known names.
- Duplicates across packs are allowed ("Pizza" in Food and Kids) but each pack is deduplicated internally, case- and punctuation-insensitive.

### Generation pipeline (build-time, not runtime)

1. A content subagent generates each pack with an LLM in batches of 100, given the pack brief and phrase rules.
2. A script normalizes, dedupes, and validates length and schema.
3. A second LLM pass acts as a reviewer: rejects obscure, offensive, or undescribable phrases and fills taboo words.
4. Output is one JSON file per pack in `content/packs/`, validated by a Zod schema in CI.
5. A human spot-check of 50 random phrases per pack before release (Ashaank).

## 5. Screens and design

Seven screens in v1. Main flow: Home → Setup → Pack Picker → Round → Caught → Scoreboard → (next round or Win).

| Screen | Purpose | Key elements |
| --- | --- | --- |
| Home | Start fast | Big Quick Play button, Custom Game, How to Play, Settings |
| Setup | Configure game | Team cards (name, color, players), target score stepper, skips, fuse range slider, mode picker (P1) |
| Pack Picker | Choose content | Pack grid with emoji art, phrase count, tags; select all; search |
| Round | Play | Huge phrase text centered, Got it (bottom, full width, thumb-reachable), Skip (small), pause (top corner), team color as background tint of whose turn it is |
| Caught | Payoff moment | Full-screen flash, buzzer, "Team Red got caught!", +1 animation for scorers |
| Scoreboard | Between rounds | Team scores, undo last point, Next Round |
| Win | End | Winner, confetti, game stats (P1), Play Again (same settings) |

### Design direction

- Loud, bright, toy-like: thick rounded type (e.g. Baloo 2 or Fredoka), chunky buttons with drop shadows, high-saturation team colors.
- Portrait only. Phrase text auto-sizes to fill width; min 40 pt.
- Round screen must be readable at arm's length in a dim room; dark-mode-first palette for the Round screen.
- Got it button has a 300 ms debounce so a frantic double-tap never skips two phrases.
- Keep the screen awake during rounds.

## 6. Tech stack and architecture

Expo (React Native) with TypeScript: one codebase for iOS and Android, fast iteration, and EAS for store builds.

| Concern | Choice |
| --- | --- |
| Framework | Expo SDK (latest stable), React Native, TypeScript strict |
| Navigation | Expo Router |
| State | Zustand (game state machine in a pure module, store wraps it) |
| Persistence | expo-sqlite or MMKV for seen-history, settings, custom packs |
| Audio | expo-audio, sounds preloaded at launch |
| Haptics / wake | expo-haptics, expo-keep-awake |
| Animation | react-native-reanimated, Lottie for confetti |
| Validation | Zod (pack schema, share-code parsing) |
| Tests | Jest + React Native Testing Library; Maestro for E2E flows |
| CI | GitHub Actions: typecheck, lint, unit tests, content validation |

### Repo structure

```
blurt/
  app/                 # Expo Router screens (UI only)
  src/engine/          # pure TS game logic: rules, fuse, scoring, draw
  src/store/           # Zustand stores wrapping engine
  src/audio/           # sound + haptics service
  src/content/         # pack loader, no-repeat history, custom packs
  src/ui/              # design system components + theme tokens
  src/config.ts        # APP_NAME, defaults
  content/packs/*.json # bundled packs (generated)
  content/schema.ts    # Zod schema shared by app + scripts
  scripts/gen-packs/   # LLM generation + review + validation
  assets/sounds/       # buzzers + ticks (CC0 only)
  e2e/                 # Maestro flows
```

**Key architectural rule:** `src/engine` has no React or Expo imports. It is a deterministic state machine with an injectable clock and RNG, so it can be unit-tested exhaustively and built in parallel with the UI.

## 7. Data models and contracts

These types are the contract between subagents. The orchestrator writes them first (Phase 0) and nobody changes them without the orchestrator's approval.

```ts
// content/schema.ts
export type Difficulty = 1 | 2 | 3;

export interface Phrase {
  id: string;            // `${packId}:${slug}`
  text: string;          // 1-5 words, <= 32 chars
  difficulty: Difficulty;
  taboo?: [string, string, string];
}

export interface Pack {
  id: string;            // kebab-case
  name: string;
  emoji: string;
  description: string;
  tags: ('family' | 'adult' | 'kids' | 'hard' | 'local' | 'custom')[];
  version: number;
  phrases: Phrase[];
}

// src/engine/types.ts
export type Mode = 'classic' | 'taboo' | 'charades' | 'one-word';

export interface Team { id: string; name: string; color: string; players: string[] }

export interface GameSettings {
  mode: Mode;
  teams: Team[];              // 2-4
  packIds: string[];
  targetScore: number;        // default 7
  skipsPerTurn: number | null;// null = unlimited
  fuseMinMs: number;          // default 45000
  fuseMaxMs: number;          // default 75000
  showFuse: boolean;          // chill mode
}

export type Phase = 'setup' | 'playing' | 'paused' | 'caught' | 'scoreboard' | 'won';

export interface GameState {
  settings: GameSettings;
  phase: Phase;
  scores: Record<string, number>;
  holderTeamIndex: number;
  currentPhrase: Phrase | null;
  fuseEndsAt: number | null;  // engine-internal; UI must not display unless showFuse
  skipsLeft: number | null;
  roundLog: { caughtTeamId: string; at: number }[];
}

export type Action =
  | { type: 'START_ROUND' } | { type: 'GOT_IT' } | { type: 'SKIP' }
  | { type: 'PAUSE' } | { type: 'RESUME' } | { type: 'TICK'; now: number }
  | { type: 'UNDO_LAST_POINT' } | { type: 'NEXT_ROUND' } | { type: 'END_ROUND_NO_SCORE' };

// Engine entry point: pure reducer
export function reduce(state: GameState, action: Action, deps: { now(): number; rng(): number; draw(): Phrase }): GameState;
```

### Service interfaces

- `ContentService`: `listPacks()`, `getPack(id)`, `createDrawer(packIds) → () => Phrase` (honors no-repeat history), `markSeen(phraseId)`, `resetHistory(packId?)`.
- `AudioService`: `preload()`, `startTicking(progress0to1)`, `stopTicking()`, `playBuzzer(id | 'random')`, `haptic(kind)`.
- `SettingsStore`: typed get/set with defaults from `src/config.ts`.

## 8. Multi-agent build plan

One orchestrator agent owns the plan, the contracts in section 7, and merges; up to six subagents build in parallel, each owning a disjoint set of directories so they never edit the same file.

### Instructions to the orchestrator

1. Read this whole PRD before spawning anything.
2. Phase 0 (you, alone): scaffold the Expo app, install dependencies, set up lint/typecheck/test/CI, write `content/schema.ts`, `src/engine/types.ts`, the service interfaces as TS interfaces with stub implementations, theme tokens, and `src/config.ts`. Commit. This is the shared contract.
3. Phase 1: spawn subagents A–F in parallel, each on its own git branch or worktree, each given this PRD, its row below, and the rule: *do not edit files outside your owned paths; if a contract must change, stop and ask the orchestrator.*
4. Merge each branch as soon as its acceptance checks pass. Run the full test suite after every merge.
5. Phase 2 (integration agent G, after A–E merge): wire screens to store, engine, audio, and content; run E2E flows.
6. Phase 3: spawn a QA/polish agent (H) to run every acceptance test in section 9, file issues, and fix them. Then P1 features, again in parallel where paths don't overlap.

### Subagent workstreams

| Agent | Owns | Builds | Depends on | Done when |
| --- | --- | --- | --- | --- |
| A Engine | `src/engine/` | Pure reducer, fuse logic with jitter, scoring, undo, skip limits | Phase 0 types | 95%+ line coverage; property tests for scoring and no double-advance |
| B Content runtime | `src/content/`, `src/store/settings*` | Pack loader, drawer with persisted no-repeat history, settings store, custom-pack storage (P1 stub) | Phase 0 schema | Unit tests: no phrase repeats until pack exhausted, survives app restart |
| C Content generation | `scripts/gen-packs/`, `content/packs/` | Generation, dedupe, review pipeline; all launch packs from section 4 | Phase 0 schema | All packs pass Zod validation; 10,000+ phrases; dedupe report clean |
| D Audio + haptics | `src/audio/`, `assets/sounds/` | AudioService, 30+ CC0 buzzers, tick loop whose tempo scales with progress, haptics | Phase 0 interface | Plays on iOS and Android dev builds; license list in `assets/sounds/LICENSES.md` |
| E Design system | `src/ui/` | Theme, Button, PhraseText (auto-fit), TeamCard, PackTile, Stepper, Slider, Confetti | Phase 0 tokens | Storybook-style gallery screen renders all components in light/dark |
| F Screens | `app/` | All 7 screens against mocked store, How to Play, Settings | E's components (can start with placeholders) | Every screen navigable with mock data |
| G Integration | `src/store/game*`, glue in `app/` | Connect store to engine, content, audio; app lifecycle pause | A, B, D, E, F merged | Maestro E2E: Quick Play to Win passes on both platforms |
| H QA + polish | Whole repo (issues only, then fixes) | Runs section 9, accessibility pass, performance | G merged | All P0 acceptance criteria green |

A, B, C, D, E and F run simultaneously. C is the longest pole (LLM generation), so start it first and let it run in the background.

### Coordination rules

- Contracts in section 7 are frozen after Phase 0 except by the orchestrator.
- Each subagent writes a short `HANDOFF.md` in its folder: what it built, how to use it, known gaps.
- Conventional commits; one PR per agent; CI must pass before merge.
- No subagent adds a dependency without noting it in its handoff; the orchestrator resolves conflicts in `package.json`.

## 9. Acceptance criteria

v1.0 is done when every box below is checked on a physical iPhone and a physical Android phone.

### Gameplay

- [ ] Quick Play reaches the first phrase in 2 taps from cold launch, under 30 s for a new user.
- [ ] Fuse duration varies between rounds and falls within the configured range (verified by engine tests over 10,000 seeded runs).
- [ ] Tick tempo audibly accelerates; the remaining time is never shown unless chill mode is on.
- [ ] Double-tapping Got it within 300 ms advances only one phrase.
- [ ] Backgrounding the app or receiving a call pauses the fuse and hides the phrase.
- [ ] Correct team(s) score when caught, for 2, 3 and 4 teams; undo restores the prior score.
- [ ] Game ends exactly at the target score and Play Again keeps settings.

### Content

- [ ] 30+ packs and 10,000+ phrases bundled; every pack selectable with no purchase prompt anywhere.
- [ ] No phrase repeats within a pack until the pack is exhausted, including across app restarts.
- [ ] After Dark packs hidden until the 18+ toggle is on and never in Quick Play.

### Platform and quality

- [ ] App works in airplane mode end to end; no network requests during play.
- [ ] Cold start under 2 s on a mid-range Android device; Round screen holds 60 fps.
- [ ] Screen stays awake during rounds.
- [ ] VoiceOver/TalkBack can operate Home, Setup and Settings; text scales with system font size.
- [ ] CI green: typecheck, lint, unit tests, content validation, Maestro E2E.
- [ ] All sound assets CC0 or owned, listed in `LICENSES.md`.
- [ ] No Phrase Frenzy text, phrases, sounds, or art copied; all content original.

## 10. Risks and open questions

The biggest risk is phrase quality, not code: a game with 10,000 mediocre phrases loses to one with 3,000 great ones.

| Risk | Mitigation |
| --- | --- |
| LLM-generated phrases are bland or obscure | Two-pass review, difficulty tags, human spot-check, in-app "flag this phrase" stored locally for the next content update |
| "Blurt" name taken on App Store or trademarked | Check before submission; name lives in one config constant; backups in section 1 |
| Too close to Phrase Frenzy or Catch Phrase (Hasbro) | Original name, art, sounds and phrases; never use "Catch Phrase" in store listing copy |
| Free with no revenue | Accepted for v1; optional tip jar in P1 |
| Audio latency on low-end Android | Preload all sounds; test on a budget device in Phase 3 |

### Open questions

- [ ] Final name after store and trademark check.
- [ ] Ship After Dark packs in v1, or hold for v1.1 to simplify App Store age rating?
- [ ] Tip jar in P1, or cut entirely?
- [ ] Which non-English language ships first?

## 11. App Store readiness

QA agent H owns this checklist alongside section 9; release is blocked until every item is checked or explicitly waived by Ashaank.

### Build and testing

- [ ] Store builds produced with EAS Build and uploaded with EAS Submit; signing credentials managed by EAS.
- [ ] All device testing on development builds, not Expo Go (audio session and haptics differ).
- [ ] Audio plays with the iOS silent switch on (playback audio category), with an in-app setting to respect silent mode.
- [ ] Zero crashes across a full Quick Play to Win session on iOS, a recent Android phone, and a budget Android phone.
- [ ] Google Play closed test running with 12+ testers for 14+ days before requesting production access (required for new personal developer accounts). Start this as soon as Phase 2 produces a playable build.

### Policy and legal

- [ ] App name confirmed unique on both stores and cleared by a basic trademark search.
- [ ] No "Catch Phrase" or other trademarks in the name, subtitle, keywords, description, or screenshots (Apple guidelines 4.3 and 5.2).
- [ ] No phrases, sounds, art or copy taken from Phrase Frenzy or any other game.
- [ ] Age rating questionnaire answered for all content in the binary, including toggled-off packs. Default plan: v1 ships family-friendly only; After Dark packs move to a later release.
- [ ] Not opted into the Kids Category.
- [ ] Any tip jar uses Apple in-app purchase on iOS and Google Play Billing on Android; no external payment links.

### Privacy

- [ ] Privacy labels declare "Data Not Collected" on both stores; no analytics or ad SDKs in the dependency tree.
- [ ] If crash reporting is added, it collects no personal data and the privacy labels are updated to disclose it.
- [ ] Privacy policy published at a public URL and linked in both store listings.

### Store listing and ratings

- [ ] Screenshots for required iPhone, iPad (if supported) and Android sizes, showing the Round, Caught and Pack Picker screens with real phrases.
- [ ] Subtitle and keywords target: party game, charades, word guessing, family game night, offline.
- [ ] Description leads with "every pack free, no ads, works offline."
- [ ] In-app review prompt (StoreKit / Play In-App Review) shown only on the Win screen, at most once per 3 completed games.
- [ ] Support URL or email live.

### Accounts

- [ ] Apple Developer Program enrolled ($99/year).
- [ ] Google Play Console account created ($25 one-time) and identity verified.
