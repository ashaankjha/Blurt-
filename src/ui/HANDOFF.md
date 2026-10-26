# src/ui handoff (Agent E, design system)

Loud, toy-like components for Blurt!: Baloo 2 type, chunky buttons whose face presses down
into a solid darker block, color-blind-safe team colors. Everything is exported from
`src/ui/index.tsx`. Props are in `types.ts` (frozen; I only added optional props, each marked
`(E, optional)`).

## Files

| File                              | What                                                                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `tokens.ts`                       | Palette (light/dark), TEAM_COLORS, fonts, sizes, spacing, radii, `textVariants`, `buttonSizes`, `motion`, `fuseColors`, `phraseLineHeight` |
| `theme.tsx`                       | `ThemeProvider`, `useTheme`, `makeTheme`                                                                                                   |
| `color.ts`                        | Pure WCAG contrast, `readableTextOn`, `shade`/`tint`/`withAlpha`, `teamBackground`, color-blindness simulation + delta E                   |
| `Chunky.tsx`                      | `ChunkyPressable`, the press-down primitive behind Button, IconButton, Chip, PackTile, Segmented, Stepper                                  |
| `phraseFit.ts`                    | Pure auto-fit math for PhraseText, with Baloo 2 ExtraBold advance widths read from the TTF                                                 |
| `rangeMath.ts`, `confettiMath.ts` | Pure helpers for Stepper/RangeSlider and the confetti particles                                                                            |
| `Gallery.tsx`                     | Storybook-style screen (mounted at `/gallery`): every component, light + dark, with a Both/Light/Dark switch                               |
| `dev/fontMetrics.ts`              | Dev script that regenerates the advance-width table if the phrase font changes                                                             |

## Usage notes

- **Theme.** `useTheme()` works without a provider (it follows the OS scheme and reduce-motion).
  `app/_layout.tsx` can wrap the Stack in `<ThemeProvider>` (optional). `Screen scheme="dark"`
  gives all its children a nested dark theme, so Card, Button, ScoreRow and AppText inside it
  read dark colors. `ThemeProvider reduceMotion` overrides the OS setting (tests, gallery).
- **Reduce motion** comes from reanimated's `useReducedMotion`. When it is on, button
  press-down and the toggle snap instantly, the PhraseText pop, ScoreRow badge pop and fuse spark
  flicker are skipped, and Confetti renders nothing (it still calls `onDone`).
- **Round screen tint.** Pass a deep shade so white text stays readable:
  `<Screen scheme="dark" tint={findTeamColor(team.color)?.deep ?? teamBackground(team.color)}>`.
  Every `TEAM_COLORS` entry now has `text` (an AA label color on the swatch) and `deep`
  (a background with 7:1 or more against white).
- **Button.** `color` overrides the face (for example a team color), and the label color is
  picked for contrast. `debounceMs={300}` gives the PRD's Got it double-tap guard at the UI level
  (the engine also has one). Every size is at least 48 px tall.
- **PhraseText** fills its parent, so give it a flex container. It measures its box once
  (`onLayout`) and computes the size synchronously, between 40 and 96 (or `maxFontSize`). It
  wraps on word boundaries, and a new phrase renders directly at its final size, so nothing
  flickers. The text is invisible only before the very first layout. `hidden` removes the phrase
  from the tree, so a screen reader cannot read it out, and shows a "Paused" placeholder
  (`hiddenLabel`). The phrase ignores OS font scaling on purpose, because it is already 40 or larger.
- **AppText** scales with Dynamic Type, capped per variant (`textVariants[v].maxScale`: display
  1.3x up to body/caption 2x). `display`, `title` and `heading` default to role `header`.
- **Stepper / RangeSlider.** Each is `adjustable` for VoiceOver/TalkBack (swipe up/down, which is
  `accessibilityActions` increment/decrement). RangeSlider exposes one adjustable element per
  thumb (`${testID}-low` / `-high`), and the thumbs never cross. Dragging uses the RN responder
  system, so there is no gesture-handler dependency.
- **Segmented** compares values with `Object.is`, so `null` (for example unlimited skips) works.
- **ToggleRow** is a pressable row with role `switch` (tap anywhere on the row). Tests should
  press it, not fire `valueChange`.
- **TeamCard** is stateless (`onChange(patch)`). It edits the name (`Team N name` field) and the
  color (radio swatches; colors in `usedColors` stay disabled and are announced as "taken"),
  and adds, edits and removes players. Removing the team needs `canRemove`.
- **PackTile** is role `checkbox` with a check badge, a thick border and a filled face when
  selected. It stretches to the height of its grid row.
- **Disabled.** `Segmented`, `Chip`, `ToggleRow`, `IconButton` and `Button` take `disabled`.
  They dim, ignore presses and set `accessibilityState.disabled`.
- **Confetti** is an absolute-fill overlay. Put it as the last child of a full-screen container.
  It fires on each false-to-true change of `active`.

## Color and contrast (verified in `tokens.test.ts`)

- Every foreground token is WCAG AA (4.5:1 or more) on background and surface in both schemes,
  and every `xText` label is AA on its `x` fill. In light mode the fills are deep with white
  labels. In dark mode the fills are bright with dark ink labels, so
  **`palette.dark.primaryText` and `secondaryText` changed from white to ink.**
- Team colors were tuned while keeping their names. Blue, Pink, Teal and Red were in the
  4.0-4.4 dead zone for both white and ink text, and Pink and Teal became nearly identical
  under deuteranopia (delta E 3). New values: Blue `#1A6BD6`, Orange `#EE8200`, Pink `#F07AB6`,
  Teal `#00806A`, Yellow `#F2D200`, Red `#CC3D0B`. Every pair now stays at delta E 15 or more
  under protanopia, deuteranopia and tritanopia simulation.
- Light `primary`, `success` and `danger` were darkened for AA. Tokens added: `successText`,
  `dangerText`, `track`, `inputBackground`, `overlay` and `placeholder`.
- Screens read team colors from `TEAM_COLORS`, so nothing hard-codes the old hex values.
  Persisted settings saved with old hex values still render: unknown colors fall back to
  `readableTextOn`.

## Testing

`jest.setup.ts` mocks `react-native-worklets` and `react-native-reanimated` with the libraries'
own mocks. It also stubs reanimated's native initializer, because the reanimated jest resolver
lives in `package.json`, which this agent does not own. In those mocks, animations finish
immediately and `useReducedMotion()` is false. Use `<ThemeProvider reduceMotion>` to test
reduce-motion paths. Confetti is hidden from accessibility, so query it with
`{ includeHiddenElements: true }`.

Co-located tests: `tokens.test.ts` (contrast and color blindness), `phraseFit.test.ts`
(including a fast-check property), `math.test.ts`, `components.test.tsx` (every component and
its key interactions) and `Gallery.test.tsx` (both schemes).

## Known gaps

- No device or visual QA yet; the web export bundles. Check on hardware that the Baloo 2 line
  heights don't clip accented capitals on Android. Also check the PhraseText width estimate
  (92% fill headroom) against real rendering, especially for non-ASCII phrases, which use a
  conservative fallback width.
- RangeSlider drags call `onChange` on every snapped step, which re-renders the parent during
  the drag. That is fine for the setup screen.
- The `@expo-google-fonts` weights must stay loaded (`_layout.tsx` already does this). Without
  them, text falls back to the system font and PhraseText sizing becomes approximate.
- To run `npx expo export --platform web` from a worktree that symlinks `node_modules`, set
  `EXPO_ROUTER_APP_ROOT=$PWD/app`. Otherwise expo-router bundles the main checkout's `app/`.
- No new dependencies.
