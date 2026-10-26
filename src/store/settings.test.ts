import { Storage } from 'expo-sqlite/kv-store';

import { createMemoryKV } from '../content/kv';
import {
  createSettingsStore,
  DEFAULT_SETTINGS,
  sanitizeSettings,
  SETTINGS_STORAGE_KEY,
  SETTINGS_VERSION,
  useSettings,
} from './settings';

describe('settings store', () => {
  it('starts with defaults', () => {
    const store = createSettingsStore(createMemoryKV());
    const { set, setDefaultRules, resetAll, ...state } = store.getState();
    expect(state).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.defaultRules).toMatchObject({ targetScore: 7, skipsPerTurn: 3, fuseMinMs: 45_000 });
  });

  it('persists and rehydrates synchronously on a new instance (app restart)', () => {
    const kv = createMemoryKV();
    const a = createSettingsStore(kv);
    a.getState().set('afterDarkEnabled', true);
    a.getState().set('volume', 0.4);
    a.getState().set('lastPackIds', ['movies', 'animals']);
    a.getState().setDefaultRules({ targetScore: 10, skipsPerTurn: null });

    const raw = JSON.parse(kv.get(SETTINGS_STORAGE_KEY)!);
    expect(raw.version).toBe(SETTINGS_VERSION);
    expect(raw.state.set).toBeUndefined();

    const b = createSettingsStore(kv);
    // No await: the first read (first render) already has persisted values.
    expect(b.persist.hasHydrated()).toBe(true);
    expect(b.getState()).toMatchObject({
      afterDarkEnabled: true,
      volume: 0.4,
      lastPackIds: ['movies', 'animals'],
      defaultRules: { ...DEFAULT_SETTINGS.defaultRules, targetScore: 10, skipsPerTurn: null },
    });
  });

  it('merges persisted data with defaults so new keys get defaults', () => {
    const kv = createMemoryKV({
      [SETTINGS_STORAGE_KEY]: JSON.stringify({
        version: 1,
        state: { soundEnabled: false, defaultRules: { targetScore: 12 }, unknownKey: 1 },
      }),
    });
    const s = createSettingsStore(kv).getState();
    expect(s.soundEnabled).toBe(false);
    expect(s.hapticsEnabled).toBe(DEFAULT_SETTINGS.hapticsEnabled);
    expect(s.defaultRules).toEqual({ ...DEFAULT_SETTINGS.defaultRules, targetScore: 12 });
    expect((s as unknown as Record<string, unknown>).unknownKey).toBeUndefined();
  });

  it('falls back to defaults for corrupt or mistyped values', () => {
    expect(createSettingsStore(createMemoryKV({ [SETTINGS_STORAGE_KEY]: '{oops' })).getState().volume).toBe(1);
    const s = sanitizeSettings({
      volume: 7,
      buzzerId: 3,
      lastPackIds: ['a', 2],
      defaultRules: { mode: 'chaos', skipsPerTurn: 'x', showFuse: true },
    });
    expect(s.volume).toBe(1);
    expect(s.buzzerId).toBe('random');
    expect(s.lastPackIds).toEqual(['a']);
    expect(s.defaultRules).toEqual({ ...DEFAULT_SETTINGS.defaultRules, showFuse: true });
  });

  it('resetAll restores every default and persists it', () => {
    const kv = createMemoryKV();
    const a = createSettingsStore(kv);
    a.getState().set('hasSeenTutorial', true);
    a.getState().setDefaultRules({ mode: 'taboo' });
    a.getState().resetAll();
    const { set, setDefaultRules, resetAll, ...state } = a.getState();
    expect(state).toEqual(DEFAULT_SETTINGS);
    expect(createSettingsStore(kv).getState().defaultRules.mode).toBe('classic');
    // Defaults object is never mutated through the store.
    expect(DEFAULT_SETTINGS.defaultRules.mode).toBe('classic');
  });

  it('the app store persists through expo-sqlite/kv-store (mocked in Jest)', () => {
    useSettings.getState().set('hapticsEnabled', false);
    const raw = JSON.parse(Storage.getItemSync(SETTINGS_STORAGE_KEY)!);
    expect(raw.state.hapticsEnabled).toBe(false);
    useSettings.getState().resetAll();
    expect(JSON.parse(Storage.getItemSync(SETTINGS_STORAGE_KEY)!).state.hapticsEnabled).toBe(true);
  });
});
