import { createMemoryKV, KV_KEYS } from '../content/kv';
import { createReviewPrompt, REVIEW_EVERY_N_GAMES, type StoreReviewApi } from './review';

function makeStoreReview(available = true) {
  return {
    isAvailableAsync: jest.fn(() => Promise.resolve(available)),
    requestReview: jest.fn(() => Promise.resolve()),
  } satisfies StoreReviewApi;
}

function setup(opts: { platform?: string; available?: boolean; initial?: Record<string, string> } = {}) {
  const kv = createMemoryKV(opts.initial);
  const storeReview = makeStoreReview(opts.available ?? true);
  const prompt = createReviewPrompt({ kv, platform: opts.platform ?? 'ios', loadStoreReview: () => storeReview });
  /** Completes a game and visits the Win screen, like the app does. */
  const winGame = async () => {
    prompt.recordCompletedGame();
    return prompt.maybeRequestReview();
  };
  return { kv, storeReview, prompt, winGame };
}

describe('review prompt', () => {
  it('asks at most once per 3 completed games: on games 3, 6 and 9', async () => {
    expect(REVIEW_EVERY_N_GAMES).toBe(3);
    const { storeReview, winGame } = setup();
    const asked: number[] = [];
    for (let game = 1; game <= 10; game++) if (await winGame()) asked.push(game);
    expect(asked).toEqual([3, 6, 9]);
    expect(storeReview.requestReview).toHaveBeenCalledTimes(3);
  });

  it('revisiting the Win screen of the same game never asks twice', async () => {
    const { storeReview, prompt, winGame } = setup();
    await winGame();
    await winGame();
    expect(await winGame()).toBe(true);
    expect(await prompt.maybeRequestReview()).toBe(false);
    expect(await prompt.maybeRequestReview()).toBe(false);
    expect(storeReview.requestReview).toHaveBeenCalledTimes(1);
  });

  it('persists the counter in kv across app restarts', async () => {
    const first = setup();
    await first.winGame();
    await first.winGame();
    expect(JSON.parse(first.kv.get(KV_KEYS.review) ?? '{}')).toEqual({ completedGames: 2, lastPromptAt: null });
    // "Restart": a new prompt over the same storage.
    const storeReview = makeStoreReview();
    const again = createReviewPrompt({ kv: first.kv, platform: 'android', loadStoreReview: () => storeReview });
    again.recordCompletedGame();
    expect(await again.maybeRequestReview()).toBe(true);
    expect(again.getState()).toEqual({ completedGames: 3, lastPromptAt: 3 });
  });

  it('never runs on web, and never even loads the module there', async () => {
    const loadStoreReview = jest.fn(() => makeStoreReview());
    const kv = createMemoryKV();
    const prompt = createReviewPrompt({ kv, platform: 'web', loadStoreReview });
    for (let i = 0; i < 6; i++) {
      prompt.recordCompletedGame();
      expect(await prompt.maybeRequestReview()).toBe(false);
    }
    expect(loadStoreReview).not.toHaveBeenCalled();
    expect(prompt.getState().completedGames).toBe(6);
  });

  it('checks isAvailableAsync and does not use up the prompt when unavailable', async () => {
    const { storeReview, prompt, winGame } = setup({ available: false });
    for (let i = 0; i < 3; i++) await winGame();
    expect(storeReview.isAvailableAsync).toHaveBeenCalledTimes(1);
    expect(storeReview.requestReview).not.toHaveBeenCalled();
    expect(prompt.getState().lastPromptAt).toBeNull();
  });

  it('never throws: missing native module, rejecting calls, corrupt storage', async () => {
    const kv = createMemoryKV({ [KV_KEYS.review]: '{not json' });
    const missing = createReviewPrompt({
      kv,
      platform: 'ios',
      loadStoreReview: () => {
        throw new Error("Cannot find native module 'ExpoStoreReview'");
      },
    });
    expect(missing.getState()).toEqual({ completedGames: 0, lastPromptAt: null });
    for (let i = 0; i < 3; i++) missing.recordCompletedGame();
    await expect(missing.maybeRequestReview()).resolves.toBe(false);

    const rejecting = createReviewPrompt({
      kv: createMemoryKV({ [KV_KEYS.review]: JSON.stringify({ completedGames: 5, lastPromptAt: null }) }),
      platform: 'android',
      loadStoreReview: () => ({
        isAvailableAsync: () => Promise.reject(new Error('boom')),
        requestReview: () => Promise.reject(new Error('boom')),
      }),
    });
    await expect(rejecting.maybeRequestReview()).resolves.toBe(false);

    const brokenKV = createReviewPrompt({
      kv: {
        get: () => {
          throw new Error('disk');
        },
        set: () => {
          throw new Error('disk');
        },
        remove: () => {},
        keys: () => [],
      },
      platform: 'ios',
      loadStoreReview: () => makeStoreReview(),
    });
    expect(() => brokenKV.recordCompletedGame()).not.toThrow();
    await expect(brokenKV.maybeRequestReview()).resolves.toBe(false);
  });

  it('sanitizes stored values', () => {
    const { prompt } = setup({
      initial: { [KV_KEYS.review]: JSON.stringify({ completedGames: -4, lastPromptAt: 'x' }) },
    });
    expect(prompt.getState()).toEqual({ completedGames: 0, lastPromptAt: null });
  });
});
