/**
 * AudioService implementation on expo-audio + expo-haptics.
 *
 * Players are created once and reused:
 * - tick/tock: a small round-robin pool each, so fast ticks never cut each other off;
 * - UI sfx: one or two players each;
 * - buzzers: two "slots". Every buzzer file is preloaded into expo-audio's cache at launch,
 *   and the next random buzzer is pre-armed (loaded into the idle slot) so the "caught"
 *   moment plays instantly without keeping 39 native players alive (each Android player is an
 *   ExoPlayer with its own thread and decoder).
 *
 * On web, expo-audio plays from an <audio> element per player. An element created from a plain
 * asset URL can go back to the server on replay (seek to 0 + play), which breaks the "no network
 * during play" rule. So on web, preload() puts every sound (not only the buzzers) into
 * expo-audio's in-memory blob cache and then re-points each idle player at its cached copy
 * (`replace`). Native players read from the app binary, so native keeps the buzzer-only warm-up.
 *
 * Every public method is safe to call at any time (before preload, after a native failure) and
 * never throws: errors and promise rejections are swallowed.
 */
import {
  createAudioPlayer,
  getPreloadedSources,
  preload as preloadSource,
  setAudioModeAsync,
  type AudioPlayer,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { BUZZER_ASSETS, SFX_ASSETS, TICK_ASSETS, type SfxKind, type SoundAsset, type TickKind } from './catalog';
import {
  clampProgress,
  createTempoCurve,
  nextIntervalMs,
  tickStrength,
  type TempoCurve,
  type TickStrength,
} from './tempo';
import type { AudioService, BuzzerInfo, HapticKind } from './types';

export interface SoundCatalog {
  buzzers: readonly SoundAsset[];
  ticks: Record<TickKind, SoundAsset>;
  sfx: Record<SfxKind, SoundAsset>;
}

export const DEFAULT_CATALOG: SoundCatalog = { buzzers: BUZZER_ASSETS, ticks: TICK_ASSETS, sfx: SFX_ASSETS };

export interface AudioServiceOptions {
  /** Sounds to use. Defaults to the generated catalog (tests inject distinct sources). */
  catalog?: SoundCatalog;
  /** Random source in [0, 1). Defaults to Math.random. */
  rng?: () => number;
  /** Players per tick sound (tick and tock each). */
  tickPoolSize?: number;
  /** Players kept for buzzers (one playing, one pre-armed). */
  buzzerSlots?: number;
  /** Upper bound on how long preload() waits for the native preload cache. */
  preloadTimeoutMs?: number;
  /**
   * Preload every sound (ticks and sfx too) and, once cached, re-point idle players at the cached
   * copy. Defaults to true on web only (see the file comment); native keeps the buzzer-only warm-up.
   */
  preloadAllSounds?: boolean;
  /** How long the full preload keeps waiting for the cache in the background (web). */
  cacheWaitMs?: number;
}

interface AudioSettings {
  soundEnabled: boolean;
  volume: number;
  hapticsEnabled: boolean;
  respectSilentMode: boolean;
}

const DEFAULT_SETTINGS: AudioSettings = {
  soundEnabled: true,
  volume: 1,
  hapticsEnabled: true,
  respectSilentMode: false,
};

const SFX_POOL_SIZE: Record<SfxKind, number> = { gotIt: 2, skip: 2, point: 2, win: 1 };
/** Delay between the heavy thump and the error buzz of the 'caught' haptic. */
const CAUGHT_FOLLOW_UP_MS = 140;

const ignore = () => {};

/** Run fn, swallowing sync errors and async rejections. */
function safely(fn: () => unknown): void {
  try {
    const out = fn();
    if (out && typeof (out as Promise<unknown>).catch === 'function') (out as Promise<unknown>).catch(ignore);
  } catch {
    // Audio must never break the game.
  }
}

/** Restart a player from the top. seekTo and play are queued in order on the native side. */
function restart(player: AudioPlayer, volume: number) {
  safely(() => {
    player.volume = volume;
  });
  safely(() => player.seekTo(0));
  safely(() => player.play());
}

class Pool {
  private next = 0;
  constructor(
    readonly players: AudioPlayer[],
    readonly source: SoundAsset['source'],
  ) {}
  play(volume: number) {
    if (!this.players.length) return;
    const player = this.players[this.next];
    this.next = (this.next + 1) % this.players.length;
    restart(player, volume);
  }
}

interface BuzzerSlot {
  player: AudioPlayer;
  id: string | null;
  lastUsed: number;
}

interface Players {
  ticks: Record<TickKind, Pool>;
  sfx: Record<SfxKind, Pool>;
  buzzers: BuzzerSlot[];
  all: AudioPlayer[];
}

export function createAudioService(options: AudioServiceOptions = {}): AudioService {
  const rng = options.rng ?? Math.random;
  const tickPoolSize = Math.max(1, options.tickPoolSize ?? 3);
  const buzzerSlots = Math.max(1, options.buzzerSlots ?? 2);
  const preloadTimeoutMs = options.preloadTimeoutMs ?? 4000;
  const catalog = options.catalog ?? DEFAULT_CATALOG;
  const preloadAllSounds = options.preloadAllSounds ?? Platform.OS === 'web';
  const cacheWaitMs = options.cacheWaitMs ?? 20_000;
  const buzzerList = catalog.buzzers;
  const buzzerById = new Map(buzzerList.map((b) => [b.id, b]));
  const findBuzzer = (id: string) => buzzerById.get(id);

  let settings: AudioSettings = { ...DEFAULT_SETTINGS };
  let appliedSilentMode: boolean | null = null;
  let players: Players | null = null;
  let initFailed = false;
  let preloadPromise: Promise<void> | null = null;
  let useCounter = 0;
  /** Buzzer id that 'random' will play next (already loaded in a slot when possible). */
  let armedRandomId: string | null = null;

  // Tick loop state.
  let ticking = false;
  let tickTimer: ReturnType<typeof setTimeout> | null = null;
  let progress = 0;
  let curve: TempoCurve | null = null;
  let tickCount = 0;

  const soundOn = () => settings.soundEnabled && settings.volume > 0;

  function pickRandomBuzzerId(): string | null {
    if (!buzzerList.length) return null;
    const i = Math.min(buzzerList.length - 1, Math.floor(rng() * buzzerList.length));
    return buzzerList[i].id;
  }

  function newPlayer(asset: SoundAsset, created: AudioPlayer[]): AudioPlayer {
    const player = createAudioPlayer(asset.source, { updateInterval: 1000 });
    created.push(player);
    safely(() => {
      player.volume = settings.volume;
    });
    return player;
  }

  /** Create every player synchronously on first use. Returns null if the native side is unavailable. */
  function ensurePlayers(): Players | null {
    if (players || initFailed) return players;
    const created: AudioPlayer[] = [];
    try {
      const pool = (asset: SoundAsset, size: number) =>
        new Pool(
          Array.from({ length: size }, () => newPlayer(asset, created)),
          asset.source,
        );
      const ticks = { tick: pool(catalog.ticks.tick, tickPoolSize), tock: pool(catalog.ticks.tock, tickPoolSize) };
      const sfx = {
        gotIt: pool(catalog.sfx.gotIt, SFX_POOL_SIZE.gotIt),
        skip: pool(catalog.sfx.skip, SFX_POOL_SIZE.skip),
        point: pool(catalog.sfx.point, SFX_POOL_SIZE.point),
        win: pool(catalog.sfx.win, SFX_POOL_SIZE.win),
      };
      // Slot 0 starts on the first buzzer; the others pre-arm random picks.
      armedRandomId = pickRandomBuzzerId();
      const buzzers: BuzzerSlot[] = Array.from({ length: buzzerSlots }, (_, i) => {
        const id = i === 0 || !armedRandomId ? buzzerList[0].id : armedRandomId;
        return { player: newPlayer(findBuzzer(id) ?? buzzerList[0], created), id, lastUsed: 0 };
      });
      players = { ticks, sfx, buzzers, all: created };
    } catch {
      initFailed = true;
      for (const p of created) safely(() => p.remove());
      players = null;
    }
    return players;
  }

  function applyAudioMode() {
    const playsInSilentMode = !settings.respectSilentMode;
    if (appliedSilentMode === playsInSilentMode) return;
    appliedSilentMode = playsInSilentMode;
    safely(() =>
      setAudioModeAsync({
        playsInSilentMode,
        // Party game sfx: never pause or duck the group's music.
        interruptionMode: 'mixWithOthers',
        shouldPlayInBackground: false,
        allowsRecording: false,
      }),
    );
  }

  /** Make `id` loaded in some slot (reusing one that already holds it) and return that slot. */
  function loadIntoSlot(p: Players, id: string, avoid?: BuzzerSlot): BuzzerSlot | null {
    const existing = p.buzzers.find((s) => s.id === id);
    if (existing) return existing;
    const asset = findBuzzer(id);
    if (!asset) return null;
    const candidates = p.buzzers.filter((s) => s !== avoid);
    const pool = candidates.length ? candidates : p.buzzers;
    const slot = pool.reduce((lru, s) => (s.lastUsed < lru.lastUsed ? s : lru), pool[0]);
    slot.id = id;
    safely(() => slot.player.replace(asset.source));
    return slot;
  }

  function hapticNow(kind: HapticKind | TickStrength) {
    if (!settings.hapticsEnabled) return;
    const { ImpactFeedbackStyle: Impact, NotificationFeedbackType: Note } = Haptics;
    switch (kind) {
      case 'tap':
      case 'tick':
      case 'light':
        safely(() => Haptics.impactAsync(Impact.Light));
        break;
      case 'medium':
        safely(() => Haptics.impactAsync(Impact.Medium));
        break;
      case 'heavy':
        safely(() => Haptics.impactAsync(Impact.Heavy));
        break;
      case 'success':
        safely(() => Haptics.notificationAsync(Note.Success));
        break;
      case 'warning':
        safely(() => Haptics.notificationAsync(Note.Warning));
        break;
      case 'caught':
        safely(() => Haptics.impactAsync(Impact.Heavy));
        setTimeout(() => {
          if (settings.hapticsEnabled) safely(() => Haptics.notificationAsync(Note.Error));
        }, CAUGHT_FOLLOW_UP_MS);
        break;
    }
  }

  function scheduleTick() {
    if (!ticking) return;
    const ms = nextIntervalMs(progress, curve ?? createTempoCurve(rng), rng);
    tickTimer = setTimeout(onTick, ms);
  }

  function onTick() {
    tickTimer = null;
    if (!ticking) return;
    safely(() => {
      tickCount++;
      if (soundOn()) {
        const p = ensurePlayers();
        p?.ticks[tickCount % 2 === 1 ? 'tick' : 'tock'].play(settings.volume);
      }
      hapticNow(tickStrength(progress));
    });
    scheduleTick();
  }

  /** Every distinct sound source in the catalog. */
  function allSources(): SoundAsset['source'][] {
    const all = [...Object.values(catalog.ticks), ...Object.values(catalog.sfx), ...buzzerList].map((a) => a.source);
    return [...new Set(all)];
  }

  /** Resolves once expo-audio reports at least `count` cached sources, or after `maxMs`. */
  async function waitForCache(count: number, maxMs: number): Promise<void> {
    const started = Date.now();
    for (;;) {
      let cached = 0;
      try {
        cached = (await Promise.resolve(getPreloadedSources())).length;
      } catch {
        return;
      }
      if (cached >= count || Date.now() - started >= maxMs) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  /**
   * Re-create each idle player's source so it picks up expo-audio's cached copy (on web,
   * `replace` builds a new <audio> element from the blob URL). Players that are playing are left
   * alone so nothing restarts mid-sound.
   */
  function repointPlayers() {
    const p = players;
    if (!p) return;
    const refresh = (player: AudioPlayer, source: SoundAsset['source']) =>
      safely(() => {
        if (player.playing) return;
        player.replace(source);
        player.volume = settings.volume;
      });
    for (const pool of [...Object.values(p.ticks), ...Object.values(p.sfx)]) {
      for (const player of pool.players) refresh(player, pool.source);
    }
    for (const slot of p.buzzers) {
      const asset = slot.id ? findBuzzer(slot.id) : undefined;
      if (asset) refresh(slot.player, asset.source);
    }
  }

  function stopAllSound() {
    for (const p of players?.all ?? []) safely(() => p.pause());
  }

  const service: AudioService = {
    preload() {
      if (!preloadPromise) {
        preloadPromise = (async () => {
          try {
            ensurePlayers();
            applyAudioMode();
            // Warm expo-audio's source cache so buzzer swaps (replace) are near-instant. On web,
            // warm every sound and then move the players onto the cached copies.
            const sources = preloadAllSounds ? allSources() : buzzerList.map((b) => b.source);
            const settled = Promise.allSettled(
              sources.map((source) => {
                try {
                  return Promise.resolve(preloadSource(source));
                } catch (e) {
                  return Promise.reject(e);
                }
              }),
            );
            // Web's preload() returns before the fetch finishes, so wait on the cache itself. This
            // keeps going in the background past the timeout below, so a slow load still re-points.
            const warm = preloadAllSounds
              ? settled
                  .then(() => waitForCache(sources.length, cacheWaitMs))
                  .then(repointPlayers)
                  .catch(ignore)
              : settled;
            let timer: ReturnType<typeof setTimeout> | undefined;
            const timeout = new Promise<void>((resolve) => {
              timer = setTimeout(resolve, preloadTimeoutMs);
            });
            await Promise.race([warm, timeout]);
            if (timer !== undefined) clearTimeout(timer);
          } catch {
            // Never reject: the game works without audio.
          }
        })();
      }
      return preloadPromise;
    },

    startTicking(progress0to1) {
      safely(() => {
        progress = clampProgress(progress0to1);
        if (ticking) return;
        ticking = true;
        curve = createTempoCurve(rng);
        tickCount = 0;
        ensurePlayers();
        scheduleTick();
      });
    },

    stopTicking() {
      ticking = false;
      if (tickTimer !== null) {
        const t = tickTimer;
        tickTimer = null;
        safely(() => clearTimeout(t));
      }
    },

    playBuzzer(id) {
      safely(() => {
        if (!soundOn()) return;
        const p = ensurePlayers();
        if (!p) return;
        const random = id === 'random' || !findBuzzer(id);
        const target = random ? (armedRandomId ?? pickRandomBuzzerId()) : id;
        if (!target) return;
        const slot = loadIntoSlot(p, target);
        if (!slot) return;
        slot.lastUsed = ++useCounter;
        restart(slot.player, settings.volume);
        if (random) {
          // Pre-arm the next random pick in a different slot so it is ready next round.
          armedRandomId = pickRandomBuzzerId();
          if (armedRandomId && p.buzzers.length > 1) loadIntoSlot(p, armedRandomId, slot);
        }
      });
    },

    playSfx(kind) {
      safely(() => {
        if (!soundOn()) return;
        ensurePlayers()?.sfx[kind]?.play(settings.volume);
      });
    },

    haptic(kind) {
      safely(() => hapticNow(kind));
    },

    listBuzzers(): BuzzerInfo[] {
      return buzzerList.map(({ id, name }) => ({ id, name }));
    },

    configure(opts) {
      safely(() => {
        const volume = Number.isFinite(opts?.volume) ? Math.min(1, Math.max(0, opts.volume)) : settings.volume;
        settings = {
          soundEnabled: opts?.soundEnabled !== false,
          volume,
          hapticsEnabled: opts?.hapticsEnabled !== false,
          respectSilentMode: opts?.respectSilentMode === true,
        };
        applyAudioMode();
        for (const p of players?.all ?? []) {
          safely(() => {
            p.volume = volume;
          });
        }
        if (!soundOn()) stopAllSound();
      });
    },
  };

  return service;
}
