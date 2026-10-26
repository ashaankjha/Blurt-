# Store listing draft (App Store and Google Play)

Draft by QA (agent H), Oct 26, 2026. Nothing here is submitted yet. Fields marked **TODO** need a
human decision or a live URL. Character counts are checked against each store's limit.

Rules for every field (PRD 10 and 11, Apple 4.3 and 5.2): no other game's name or trademark, in
the name, subtitle, keywords, description, screenshots or promo text. Describe the game in plain
words ("pass-the-phone word game", "charades-style"). `src/policy.test.ts` scans this file.

## Identity

| Field                         | Value                                                                                         | Limit |
| ----------------------------- | --------------------------------------------------------------------------------------------- | ----- |
| App name (both stores)        | **Blurt!** (from `APP_NAME` in `src/config.ts`)                                               | 30    |
| iOS name if "Blurt!" is taken | Blurt! Offline Party Word Game (30)                                                           | 30    |
| Backup names (PRD 1)          | Hot Phrase, Fuse, Pass It!, Kaboom Clues                                                      |       |
| iOS subtitle                  | Party word game, fully offline (30)                                                           | 30    |
| Google Play short description | Every pack free, no ads, works offline. Describe it, shout it, pass the phone! (78)           | 80    |
| Primary category              | Games > Word (iOS); Word (Play)                                                               |       |
| Secondary category (iOS)      | Games > Family. Do **not** opt into the Kids Category (PRD 11).                               |       |
| Price                         | Free. No in-app purchases in v1.                                                              |       |
| Support URL / email           | **TODO**: a live address. `docs/privacy-policy.md` still has the `SUPPORT_EMAIL` placeholder. |       |
| Privacy policy URL            | **TODO**: publish `docs/privacy-policy.md` at a public URL and link it in both consoles.      |       |

## Keywords (iOS, 100 characters, comma separated, no spaces after commas)

```
party game,charades,word guessing,family game night,offline,guess the word,teams,pass the phone
```

95 characters. They cover the PRD targets: party game, charades, word guessing, family game night,
offline. Apple already indexes the name and subtitle, so "word" and "party" are not repeated
alone. Do not add other games' names as keywords.

## Promotional text (iOS, 170 characters, can change without review)

Every pack free, no ads, works offline. 27 packs and 10,000+ phrases for your next game night.

## Description (both stores)

The first line is what shows above the fold, so it leads with the PRD's promise.

> **Every pack free, no ads, works offline.**
>
> Blurt! is the loud, fast, pass-the-phone word game for your next party or family game night.
> Describe the phrase on screen, get your team to shout it out, tap Got it and pass the phone to the
> next player before the hidden fuse blows. Whoever is holding the phone when it goes off gives
> every other team a point.
>
> **How it works**
>
> - One tap Quick Play: two teams and every family pack, playing in seconds.
> - 2 to 4 teams, with team names, colors and optional player names. A seating helper makes sure
>   teams alternate around the circle.
> - A hidden fuse with a ticking sound and buzz that speeds up as it runs down. You never know
>   exactly when it will blow.
> - 39 original buzzers: air horn, sad trombone, rubber chicken and more. Pick one or let it be a
>   surprise.
> - Built-in scoreboard, target score, undo last point, and confetti for the winners.
> - Skips per turn: none, 1, 3 or unlimited.
> - Chill mode shows the fuse on screen, great for younger players.
>
> **27 packs, 10,000+ phrases, all free**
> Movies, TV Shows, Music Artists, Songs, Video Games, Internet & Memes, Celebrities, Food & Drink,
> Animals, Household, Jobs, Places, Verbs & Actions, Sports, Holidays, Fantasy & Myth, Brands,
> 90s & 2000s Nostalgia, Science, History, Geography, Idioms & Sayings, Famous Phrases, Kids, NYC,
> Road Trip USA and the Everything Mix. Phrases don't repeat until you have seen the whole pack,
> even across games.
>
> **Made for groups**
>
> - Works in airplane mode, at the cabin, on a road trip, anywhere. No account, no sign-in, no
>   internet needed.
> - No ads and no data collection. Ever.
> - Big, readable text for a dim room; VoiceOver and TalkBack support, Dynamic Type, color-blind
>   safe team colors and reduce-motion support.
>
> Gather your friends, pick your teams, and Blurt!

Notes for whoever submits:

- Counts above describe what a default install shows (After Dark off): 26 family packs plus
  Everything Mix = 27 tiles in the picker, and 10,711 distinct family phrases (the Everything Mix
  count). Sources: `content/packs/manifest.json` (29 bundled packs, 12,882 phrase rows, 11,742 in
  family packs) and `npm run content:validate` (11,753 unique phrases across all packs). 39 buzzers.
- If After Dark ships in v1, the honest totals become "30 packs, 11,000+ phrases", and the
  description should add a line such as "Optional 18+ After Dark packs, off until you turn them on
  in Settings.
- **After Dark** (18+ packs: Party, Awkward Situations, Dating) is compiled in while
  `SHIP_AFTER_DARK = true`. The description above leaves it out on purpose. PRD 11's default plan
  is to ship v1 family-only. If After Dark stays in the binary, the age rating questionnaire must
  cover it even though it is off by default (see `docs/qa-report.md`).
- Don't promise P1 features (custom packs, extra modes, stats) until they ship.

## Screenshot plan

Required sizes: iPhone 6.9" (1320x2868 or 1290x2796) and 6.5" (1284x2778 or 1242x2688); no iPad
(`supportsTablet: false`). Google Play: 2 to 8 phone screenshots, 16:9 or 9:16, 1080 px or more on
the short side. Use real phrases from the bundled packs, never placeholder text.

| #   | Screen      | What it shows                                                          | Caption (overlay)                |
| --- | ----------- | ---------------------------------------------------------------------- | -------------------------------- |
| 1   | Round       | A real phrase huge on the team-colored background, Got it button, Skip | Describe it. Shout it. Pass it!  |
| 2   | Caught      | "Team Blue got caught!", +1 badge for the scoring team                 | Don't get caught holding it      |
| 3   | Pack Picker | The pack grid with emoji, phrase counts and a few packs selected       | Every pack free. 10,000+ phrases |
| 4   | Setup       | 3 teams with names and colors, seating helper                          | 2 to 4 teams, your rules         |
| 5   | Win         | Confetti, final scores, Play Again                                     | Play again, no ads in the way    |
| 6   | Home        | Quick Play                                                             | One tap to play, fully offline   |

Draft captures of 1-3 and Home are in `docs/screenshots/` (`round.png`, `caught.png`,
`pack-picker.png`, `home.png`; 1290x2796 PNG, the iPhone 6.9" size). They come from the web build
(an `e2e/web` export, Chromium at 430x932 and 3x), which uses the same screens and fonts as the
app. To retake them: `KEEP_EXPORT=1 node e2e/web/quick-play-to-win.mjs`, then
`BLURT_WEB_DIR=<the printed export dir> node e2e/web/store-screenshots.mjs`. These drafts do not
fit Google Play as they are (Play allows at most 2:1 and 1290x2796 is 2.17:1); Play needs its own
9:16 captures, for example 1080x1920. The 6.5" iPhone set is also still to do. Before submission, retake them on a real iPhone and Android phone (or the
simulators): the status bar, safe areas and emoji style differ per platform, and Apple expects
screenshots that match the app as it runs on the device. Add the captions in a design tool, and
keep each one free of other games' names.

## Privacy labels

Both stores: **Data Not Collected** / **No data shared, no data collected.**

- The app has no accounts, analytics, ads, crash reporting, or network calls during play. Android
  store builds block the INTERNET permission (`app.config.ts`).
- The dependency tree has no analytics or ad SDKs (checked in `docs/qa-report.md`).
- Settings, phrase history, team and player names stay on the device (SQLite kv store), so they
  are not "collected" under either store's definition.
- Google Play Data safety form: "No data collected" and "No data shared".
- If crash reporting or a tip jar is ever added, update these labels before that release (PRD 11).

## Ratings

- iOS: answer the questionnaire for **everything in the binary**, including toggled-off After
  Dark packs. With After Dark compiled in, expect "Infrequent/Mild Mature/Suggestive Themes" and
  "Infrequent/Mild Crude Humor" (likely 12+). Family-only build: likely 4+.
- Google Play (IARC): same rule; family-only likely "Everyone", with After Dark likely "Teen".
- In-app review prompt: StoreKit / Play In-App Review, only on the Win screen and at most once per
  3 completed games (`src/store/review.ts`).
