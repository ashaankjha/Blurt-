import * as ExpoAudio from 'expo-audio';
import * as Haptics from 'expo-haptics';

import { audioService } from './index';
import { audioMock, hapticsMock } from './nativeMocks';
import { DEFAULT_CATALOG, createAudioService, type SoundCatalog } from './service';
import { TEMPO } from './tempo';
import type { AudioService } from './types';

/** Real catalog with distinct sources (Jest maps every asset require() to 1). */
const catalog: SoundCatalog = {
  buzzers: DEFAULT_CATALOG.buzzers.map((b, i) => ({ ...b, source: 1000 + i })),
  ticks: { tick: { ...DEFAULT_CATALOG.ticks.tick, source: 1 }, tock: { ...DEFAULT_CATALOG.ticks.tock, source: 2 } },
  sfx: {
    gotIt: { ...DEFAULT_CATALOG.sfx.gotIt, source: 11 },
    skip: { ...DEFAULT_CATALOG.sfx.skip, source: 12 },
    point: { ...DEFAULT_CATALOG.sfx.point, source: 13 },
    win: { ...DEFAULT_CATALOG.sfx.win, source: 14 },
  },
};
const buzzerIdBySource = new Map(catalog.buzzers.map((b) => [b.source as unknown, b.id]));
const isTick = (s: unknown) => s === 1 || s === 2;

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ON = { soundEnabled: true, volume: 1, hapticsEnabled: true, respectSilentMode: false };

let svc: AudioService;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  audioMock.reset();
  hapticsMock.reset();
  svc = createAudioService({ catalog, rng: seeded(1) });
});

afterEach(() => {
  svc.stopTicking();
  jest.useRealTimers();
});

describe('preload', () => {
  it('creates every player once and is idempotent', async () => {
    const first = svc.preload();
    const second = svc.preload();
    expect(second).toBe(first);
    await first;
    const count = audioMock.players.length;
    // 2x3 tick pool + 7 sfx players + 2 buzzer slots.
    expect(count).toBe(15);
    await svc.preload();
    expect(audioMock.players.length).toBe(count);
    expect(ExpoAudio.preload).toHaveBeenCalledTimes(catalog.buzzers.length);
  });

  it('sets an audio mode that plays through the silent switch and mixes with other audio', async () => {
    await svc.preload();
    expect(audioMock.audioModes).toEqual([
      expect.objectContaining({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }),
    ]);
  });

  it('resolves even when native preload hangs', async () => {
    (ExpoAudio.preload as jest.Mock).mockImplementation(() => new Promise(() => {}));
    const s = createAudioService({ catalog, preloadTimeoutMs: 500 });
    const done = jest.fn();
    void s.preload().then(done);
    await jest.advanceTimersByTimeAsync(600);
    expect(done).toHaveBeenCalled();
    (ExpoAudio.preload as jest.Mock).mockImplementation(() => Promise.resolve());
  });
});

describe('safety', () => {
  it('every call is safe before preload (players are created lazily)', () => {
    expect(() => {
      svc.configure(ON);
      svc.playSfx('gotIt');
      svc.playBuzzer('random');
      svc.haptic('tap');
      svc.startTicking(0.5);
      svc.stopTicking();
    }).not.toThrow();
    expect(audioMock.played).toContain(11);
  });

  it('never throws when the native module fails', async () => {
    (ExpoAudio.createAudioPlayer as jest.Mock).mockImplementationOnce(() => {
      throw new Error('no native module');
    });
    const s = createAudioService({ catalog });
    await expect(s.preload()).resolves.toBeUndefined();
    expect(() => {
      s.playBuzzer('random');
      s.playSfx('win');
      s.startTicking(0.2);
      jest.advanceTimersByTime(5000);
      s.stopTicking();
    }).not.toThrow();
  });

  it('swallows errors thrown by players and rejected haptics', async () => {
    await svc.preload();
    for (const p of audioMock.players) {
      p.play.mockImplementation(() => {
        throw new Error('boom');
      });
      p.seekTo.mockImplementation(() => Promise.reject(new Error('seek')));
    }
    (Haptics.impactAsync as jest.Mock).mockImplementationOnce(() => Promise.reject(new Error('haptics')));
    expect(() => {
      svc.playSfx('point');
      svc.playBuzzer('air-horn');
      svc.haptic('tap');
    }).not.toThrow();
    await Promise.resolve();
  });

  it('ignores junk configure input', () => {
    expect(() => svc.configure({ ...ON, volume: NaN })).not.toThrow();
    expect(() => svc.startTicking(NaN)).not.toThrow();
  });

  it('the exported singleton works with the global mocks', async () => {
    await audioService.preload();
    expect(audioService.listBuzzers().length).toBeGreaterThanOrEqual(30);
    expect(() => audioService.playBuzzer('random')).not.toThrow();
  });
});

describe('buzzers', () => {
  it('lists 30+ buzzers with unique ids and human names', () => {
    const list = svc.listBuzzers();
    expect(list.length).toBeGreaterThanOrEqual(30);
    expect(new Set(list.map((b) => b.id)).size).toBe(list.length);
    for (const b of list) expect(b.name).toMatch(/^[A-Z0-9]/);
  });

  it("'random' picks uniformly among all buzzers", async () => {
    await svc.preload();
    const counts = new Map<string, number>();
    const draws = 4000;
    for (let i = 0; i < draws; i++) {
      audioMock.played.length = 0;
      svc.playBuzzer('random');
      const id = buzzerIdBySource.get(audioMock.played[0]);
      expect(id).toBeDefined();
      counts.set(id as string, (counts.get(id as string) ?? 0) + 1);
    }
    expect(counts.size).toBe(catalog.buzzers.length);
    const expected = draws / catalog.buzzers.length;
    for (const n of counts.values()) {
      expect(n).toBeGreaterThan(expected * 0.5);
      expect(n).toBeLessThan(expected * 1.5);
    }
  });

  it('plays the requested buzzer, and falls back to a random one for unknown ids', async () => {
    await svc.preload();
    svc.playBuzzer('kaboom');
    expect(buzzerIdBySource.get(audioMock.played.at(-1))).toBe('kaboom');
    svc.playBuzzer('sad-trombone');
    expect(buzzerIdBySource.get(audioMock.played.at(-1))).toBe('sad-trombone');
    svc.playBuzzer('kaboom');
    expect(buzzerIdBySource.get(audioMock.played.at(-1))).toBe('kaboom');
    svc.playBuzzer('no-such-buzzer');
    expect(buzzerIdBySource.has(audioMock.played.at(-1))).toBe(true);
  });

  it('restarts the player from the top on replay', async () => {
    await svc.preload();
    svc.playBuzzer('kaboom');
    svc.playBuzzer('kaboom');
    const player = audioMock.players.find((p) => buzzerIdBySource.get(p.source) === 'kaboom');
    expect(player?.seekTo).toHaveBeenCalledWith(0);
    expect(player?.play).toHaveBeenCalledTimes(2);
  });

  it('pre-arms the next random buzzer: plays without loading, never swaps the one just played', async () => {
    await svc.preload();
    const slots = audioMock.players.filter((p) => buzzerIdBySource.has(p.source));
    expect(slots).toHaveLength(2);
    let log: [string, unknown][] = [];
    for (const p of slots) {
      const play = p.play.getMockImplementation();
      const replace = p.replace.getMockImplementation();
      p.play.mockImplementation(() => {
        log.push(['play', p]);
        play?.();
      });
      p.replace.mockImplementation((next: unknown) => {
        log.push(['replace', p]);
        replace?.(next);
      });
    }
    for (let i = 0; i < 300; i++) {
      log = [];
      svc.playBuzzer('random');
      const [first, ...rest] = log;
      expect(first[0]).toBe('play');
      for (const [kind, player] of rest) {
        expect(kind).toBe('replace');
        expect(player).not.toBe(first[1]);
      }
    }
  });
});

describe('sfx', () => {
  it('plays each UI sound and round-robins rapid repeats across the pool', async () => {
    await svc.preload();
    svc.playSfx('gotIt');
    svc.playSfx('gotIt');
    svc.playSfx('skip');
    svc.playSfx('point');
    svc.playSfx('win');
    expect(audioMock.played).toEqual([11, 11, 12, 13, 14]);
    const gotItPlayers = audioMock.players.filter((p) => p.source === 11);
    expect(gotItPlayers.map((p) => p.play.mock.calls.length)).toEqual([1, 1]);
  });
});

describe('settings', () => {
  it('mute suppresses every sound but keeps haptics', async () => {
    await svc.preload();
    svc.configure({ ...ON, soundEnabled: false });
    svc.playSfx('gotIt');
    svc.playBuzzer('random');
    svc.startTicking(0.9);
    jest.advanceTimersByTime(3000);
    expect(audioMock.played).toEqual([]);
    expect(hapticsMock.calls.length).toBeGreaterThan(0);
  });

  it('volume 0 also counts as muted', async () => {
    await svc.preload();
    svc.configure({ ...ON, volume: 0 });
    svc.playSfx('win');
    expect(audioMock.played).toEqual([]);
  });

  it('muting pauses anything already playing', async () => {
    await svc.preload();
    svc.playBuzzer('gong');
    svc.configure({ ...ON, soundEnabled: false });
    expect(audioMock.players.every((p) => !p.playing)).toBe(true);
  });

  it('haptics toggle suppresses haptics but keeps sound', async () => {
    await svc.preload();
    svc.configure({ ...ON, hapticsEnabled: false });
    svc.haptic('tap');
    svc.haptic('caught');
    svc.startTicking(0.5);
    jest.advanceTimersByTime(3000);
    expect(hapticsMock.calls).toEqual([]);
    expect(audioMock.played.some(isTick)).toBe(true);
  });

  it('applies volume to every player (clamped to 0..1)', async () => {
    await svc.preload();
    svc.configure({ ...ON, volume: 0.4 });
    expect(audioMock.players.every((p) => p.volume === 0.4)).toBe(true);
    svc.configure({ ...ON, volume: 7 });
    expect(audioMock.players.every((p) => p.volume === 1)).toBe(true);
  });

  it('respectSilentMode switches playsInSilentMode, only when it changes', async () => {
    await svc.preload();
    svc.configure({ ...ON, respectSilentMode: true });
    svc.configure({ ...ON, respectSilentMode: true, volume: 0.5 });
    svc.configure({ ...ON, respectSilentMode: false });
    expect(audioMock.audioModes.map((m) => m.playsInSilentMode)).toEqual([true, false, true]);
  });
});

describe('haptics', () => {
  it('maps every kind to an expo-haptics call', async () => {
    svc.haptic('tap');
    svc.haptic('tick');
    svc.haptic('success');
    svc.haptic('warning');
    svc.haptic('caught');
    jest.advanceTimersByTime(500);
    expect(hapticsMock.calls).toEqual([
      'impact:light',
      'impact:light',
      'notification:success',
      'notification:warning',
      'impact:heavy',
      'notification:error',
    ]);
  });
});

describe('tick loop', () => {
  it('schedules a single self-rescheduling timer and clears it on stop', async () => {
    await svc.preload();
    expect(jest.getTimerCount()).toBe(0);
    svc.startTicking(0);
    expect(jest.getTimerCount()).toBe(1);
    // Repeated calls only update progress; no extra timers.
    svc.startTicking(0.1);
    svc.startTicking(0.2);
    expect(jest.getTimerCount()).toBe(1);
    jest.advanceTimersByTime(TEMPO.maxMs);
    expect(audioMock.played.filter(isTick).length).toBeGreaterThanOrEqual(1);
    expect(jest.getTimerCount()).toBe(1);
    svc.stopTicking();
    expect(jest.getTimerCount()).toBe(0);
    const before = audioMock.played.length;
    jest.advanceTimersByTime(10_000);
    expect(audioMock.played.length).toBe(before);
  });

  it('alternates tick and tock and fires a tick haptic each time', async () => {
    await svc.preload();
    svc.startTicking(0.3);
    jest.advanceTimersByTime(4 * TEMPO.maxMs);
    const ticks = audioMock.played.filter(isTick);
    expect(ticks.length).toBeGreaterThanOrEqual(4);
    expect(ticks.slice(0, 4)).toEqual([1, 2, 1, 2]);
    expect(hapticsMock.calls.length).toBe(ticks.length);
    expect(new Set(hapticsMock.calls)).toEqual(new Set(['impact:light']));
  });

  it('speeds up with progress and the haptics intensify near the end', async () => {
    await svc.preload();
    svc.startTicking(0);
    jest.advanceTimersByTime(10_000);
    const slow = audioMock.played.filter(isTick).length;
    svc.stopTicking();
    audioMock.played.length = 0;
    hapticsMock.reset();
    svc.startTicking(1);
    jest.advanceTimersByTime(10_000);
    const fast = audioMock.played.filter(isTick).length;
    expect(slow).toBeGreaterThanOrEqual(7);
    expect(slow).toBeLessThanOrEqual(14);
    expect(fast).toBeGreaterThan(4 * slow);
    expect(new Set(hapticsMock.calls)).toEqual(new Set(['impact:heavy']));
  });

  it('picks up progress updates while running', async () => {
    await svc.preload();
    svc.startTicking(0);
    jest.advanceTimersByTime(5_000);
    const early = audioMock.played.filter(isTick).length;
    svc.startTicking(0.95);
    jest.advanceTimersByTime(TEMPO.maxMs); // let the pending slow tick fire
    audioMock.played.length = 0;
    jest.advanceTimersByTime(5_000);
    expect(audioMock.played.filter(isTick).length).toBeGreaterThan(3 * early);
  });

  it('keeps ticking (haptics only) while muted, so unmuting mid-round resumes sound', async () => {
    await svc.preload();
    svc.configure({ ...ON, soundEnabled: false });
    svc.startTicking(0.5);
    jest.advanceTimersByTime(3000);
    expect(audioMock.played).toEqual([]);
    svc.configure(ON);
    jest.advanceTimersByTime(3000);
    expect(audioMock.played.some(isTick)).toBe(true);
  });
});
