# Audio + haptics handoff (Agent D)

## What was built

| Path                                        | What                                                                                                                                                                               |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/audio/index.ts`                        | Exports the `audioService` singleton and re-exports the frozen types. Contract unchanged.                                                                                          |
| `src/audio/service.ts`                      | `createAudioService(options)`, the implementation on expo-audio and expo-haptics.                                                                                                  |
| `src/audio/tempo.ts`                        | Pure tick-tempo math (curve, jitter, haptic strength) with an injected RNG.                                                                                                        |
| `src/audio/catalog.ts`                      | Sound catalog types and lookups over the generated manifest.                                                                                                                       |
| `src/audio/sounds.generated.ts`             | **Generated** manifest (ids, names, files, static `require`s). Do not hand-edit.                                                                                                   |
| `src/audio/nativeMocks.ts`, `jest.setup.ts` | Global Jest mocks for expo-audio and expo-haptics, plus inspectable state.                                                                                                         |
| `assets/sounds/`                            | 39 buzzers, tick and tock, and 4 UI sfx (45 files, 884 KiB total). `LICENSES.md` lists every file.                                                                                 |
| `scripts/gen-sounds/`                       | The synthesizer: `dsp.ts` (oscillators, filters, envelopes, reverb), `recipes.ts` (one recipe per sound) and `build.ts` (render, master, encode, write the manifest and licenses). |

Every sound is original. They are synthesized from oscillators, filtered noise and envelopes. They contain no samples. They are owned by the project and dedicated to CC0.

Buzzers: Air Horn, Triple Air Horn, Wrong Answer Buzzer, Klaxon, Sad Trombone, Boing, Slide Whistle, Kaboom, Laser Blaster, Robot Error, Siren, Alarm Bell, Fog Horn, Big Gong, Cymbal Crash, Kazoo Taunt, 8-Bit Game Over, 8-Bit Wipeout, Clown Honk, Rubber Chicken, Zapped, Raspberry, Ba-Dum-Tss, Cuckoo Clock, UFO Warble, Record Scratch, Power Down, Glass Shatter, Referee Whistle, More Cowbell, Ding Ding Ding, Dramatic Sting, Bomb Beeper, Balloon Pop, Jaw Harp, Harp Plunge, Frying Pan Bonk, Car Horn, Sour Fanfare.

Formats: the tick, the tock, and the gotIt, skip and point sfx are 16-bit mono 44.1 kHz **WAV**. They have no codec priming delay, and Android plays them without a decoder. The buzzers and the win sfx are **AAC .m4a** (96 kbps mono). The build decodes each .m4a again and lowers its gain until the decoded peak is at or below -0.5 dBFS, so nothing clips after AAC encoding.

## How to use it (for Agent G)

```ts
import { audioService } from '../src/audio'; // path relative to app/

// Once at launch (for example in app/_layout.tsx). It resolves within about 4 s, and it never rejects.
void audioService.preload();

// Whenever settings change (subscribe to the settings store):
audioService.configure({ soundEnabled, volume, hapticsEnabled, respectSilentMode });

// During a round: call on every engine TICK with progress = elapsed / fuseDuration.
audioService.startTicking(progress); // the first call starts the loop; later calls only update progress
audioService.stopTicking(); // on pause, on caught, on end round and when leaving the screen

// Fuse blows:
audioService.stopTicking();
audioService.playBuzzer(settings.buzzerId); // 'random' or an id; an unknown id falls back to random
audioService.haptic('caught');

audioService.playSfx('gotIt' | 'skip' | 'point' | 'win');
audioService.haptic('tap' | 'success' | 'warning');
audioService.listBuzzers(); // [{ id, name }] for the settings picker; preview with playBuzzer(id)
```

Behaviour notes:

- **Progress is caller-driven.** The loop does not extrapolate. Call `startTicking(progress)` at least every 250 to 500 ms. If you call it only once, the tempo never changes.
- **Tempo.** The base interval runs from 1000 ms down to 150 ms along an eased geometric curve. Most of the speed-up happens late. Each new loop (each `startTicking` after a stop, including resume after a pause) draws a random curve: easing exponent 1.3 to 2.1, progress shift of plus or minus 0.07, and jitter depth of 15 to 25 %. Every interval then gets uniform jitter of that depth. The result is clamped to 110 to 1300 ms.
- **Ticks** alternate between tick and tock. Each tick also fires a haptic when haptics are on: light, then medium from progress 0.6, then heavy from 0.85. The loop keeps running while the sound is muted, so haptics still pulse and unmuting mid-round brings the ticks back.
- **Haptic map.** `tap` and `tick` use a light impact. `success` and `warning` use notifications. `caught` is a heavy impact, followed 140 ms later by an Error notification.
- **Mute.** `soundEnabled: false` or `volume: 0` suppresses every sound and pauses anything that is playing. `hapticsEnabled: false` suppresses every haptic.
- **Silent mode.** `respectSilentMode: false` (the default) sets `playsInSilentMode: true`, so the app plays with the iOS silent switch on. The interruption mode is `mixWithOthers`, so the group's music is never paused or ducked.
- **Safety.** Every method is safe before `preload()` because players are created lazily and synchronously. Every method is also safe if the native module fails. No method throws, and every promise rejection is swallowed.

Player layout: 3 tick players and 3 tock players (round-robin), 2 each for gotIt, skip and point, 1 for win, and 2 buzzer "slots", for 15 native players in total. `preload()` also warms expo-audio's source cache for every buzzer with `preload(source)`. After each random buzzer, the **next random pick is pre-armed** into the idle slot, so the caught moment plays with no load. A specific buzzer stays loaded after its first play. I did not create 39 buzzer players on purpose. Each Android player is an ExoPlayer with its own playback thread, and the AAC ones also hold a decoder, which is risky on budget phones.

## Regenerating sounds

```bash
npx tsx scripts/gen-sounds/build.ts                 # everything (about 8 s); requires ffmpeg on PATH
npx tsx scripts/gen-sounds/build.ts kaboom tick     # only some ids (the manifest and licenses are still rewritten)
npx tsx scripts/gen-sounds/build.ts --keep-wav      # also keeps WAV masters in scripts/gen-sounds/out/ (gitignored)
```

The output is deterministic: each recipe has a seeded PRNG, and ffmpeg runs in bitexact mode. Running it again produces byte-identical files. To add a buzzer, add a recipe to `BUZZERS` in `recipes.ts`, run the build, and commit `assets/sounds/*`, `LICENSES.md` and `src/audio/sounds.generated.ts`. The tests check that the buzzer count is 30 or more, that every referenced file exists with a valid WAV or M4A header, that the folder has no stray files, that the total size is under 2 MB, and that every file has a license row.

## Tests

`tempo.test.ts` covers the bounds, monotonicity, the average decrease, the jitter spread, the per-round variation and the haptic strength (fast-check properties). `service.test.ts` covers the following with fake timers:

- preload idempotence, the timeout and the audio mode
- safety before preload and on native failure
- uniform `'random'`, and pre-arming that never swaps the playing buzzer
- the mute, volume and haptics toggles
- the tick timer lifecycle and acceleration

`catalog.test.ts` covers the assets and licenses. Any test in the repo can inspect playback via `audioMock` and `hapticsMock` from `src/audio/nativeMocks`.

## Device checks still needed (dev build, not Expo Go)

1. **Latency.** Check the tick onset (WAV) and the buzzer at the caught moment on an iPhone and on a budget Android phone. Replay is `seekTo(0)` followed immediately by `play()`. Confirm that a finished player restarts cleanly from the top, with no tail blip and no missed first tick. On Android, `STATE_ENDED` players must restart. If ticks lag or drop at 150 ms, raise `tickPoolSize`.
2. **iOS silent switch.** With the switch on, sound plays by default. With `respectSilentMode: true` it is muted. On Android, `playsInSilentMode: false` suppresses playback in silent and vibrate ringer modes.
3. **Simultaneous playback.** Check a tick overlapping gotIt, a double tap on gotIt (2-player pool), a buzzer together with the caught haptic, and the win fanfare right after the point chime.
4. **Mixing.** With Spotify or Apple Music playing, the music should keep playing un-ducked, and the sfx should still be audible over it.
5. **Pre-armed buzzer.** The caught buzzer should start instantly. Previewing a different buzzer in Settings has a short load, which is acceptable.
6. **Loudness and balance on phone speakers.** Check that the low content (Fog Horn, Gong, Kaboom) carries through the harmonics, that the buzzers are similarly loud, and that the tick is audible over party noise but not harsh.
7. **Haptics.** Check the feel of 150 ms heavy pulses near the end of the fuse, and Android's vibration fallback for impact styles.
8. **Interruptions.** In `mixWithOthers` mode Android does not deliver audio-focus loss. A phone call pause must come from AppState handling (Agent G).
9. **AAC priming.** The buzzers should start without a gap. ffmpeg writes an edit list, and AVPlayer and ExoPlayer should honor it.

## Known gaps / requests

- **Config to change (orchestrator, `app.config.ts`).** The expo-audio plugin defaults to `enableBackgroundPlayback: true`. That adds iOS `UIBackgroundModes: audio` and the Android `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_MEDIA_PLAYBACK` permissions plus a media service. The game never plays audio in the background. Apple guideline 2.5.4 and the Play foreground-service declaration both make this a review risk. Recommended setting: `['expo-audio', { microphonePermission: false, recordAudioAndroid: false, enableBackgroundPlayback: false }]`.
- The sounds were checked by level analysis and spectrograms, not by ear. A listening pass on a real phone is still needed, and any sound that does not land can be tuned in `recipes.ts`.
- No dependencies were added. ffmpeg is a dev-only tool, needed only to regenerate sounds.
