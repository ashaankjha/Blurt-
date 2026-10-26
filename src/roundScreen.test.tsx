/**
 * Round screen performance and platform checks (PRD 9: 60 fps, screen stays awake).
 * Lives in src/ because Expo Router turns every file under app/ into a route.
 */
import { act, render, screen } from '@testing-library/react-native';
import { useKeepAwake } from 'expo-keep-awake';

import Round from '../app/round';
import * as engine from './engine';
import { FUSE_TICK_MS, useGame } from './store/game';
import { useSettings } from './store/settings';

jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));

beforeEach(() => {
  jest.useFakeTimers();
  useSettings.getState().resetAll();
});

afterEach(async () => {
  useGame.getState().quitGame();
  await act(() => jest.runOnlyPendingTimers());
  jest.useRealTimers();
  jest.restoreAllMocks();
});

/** Round calls holderLabel once per render, so its call count is the screen's render count. */
const renders = () => jest.spyOn(engine, 'holderLabel');

describe('Round screen', () => {
  it('keeps the screen awake while mounted', async () => {
    useGame.getState().quickPlay();
    await render(<Round />);
    expect(useKeepAwake).toHaveBeenCalledWith('blurt-round', expect.anything());
  });

  it('hidden fuse: does not re-render on the 100 ms fuse TICKs', async () => {
    useGame.getState().quickPlay();
    const spy = renders();
    await render(<Round />);
    const after = spy.mock.calls.length;
    expect(after).toBeGreaterThan(0);
    const phrase = useGame.getState().game?.currentPhrase;
    // 3 s of fuse loop: 30 TICKs that change nothing.
    await act(() => jest.advanceTimersByTime(30 * FUSE_TICK_MS));
    expect(useGame.getState().game?.phase).toBe('playing');
    expect(useGame.getState().game?.currentPhrase).toBe(phrase);
    expect(spy.mock.calls.length).toBe(after);
    expect(screen.queryByTestId('round-fuse')).toBeNull();
  });

  it('chill mode: only the fuse bar updates, not the whole screen', async () => {
    useSettings.getState().setDefaultRules({ showFuse: true });
    useGame.getState().quickPlay();
    const spy = renders();
    await render(<Round />);
    const after = spy.mock.calls.length;
    const fuse = () => screen.getByRole('progressbar', { name: 'Fuse' }).props.accessibilityValue.now as number;
    const start = fuse();
    await act(() => jest.advanceTimersByTime(5_000));
    expect(fuse()).toBeLessThan(start);
    expect(spy.mock.calls.length).toBe(after);
  });

  it('re-renders when something visible changes (Got it)', async () => {
    useGame.getState().quickPlay();
    const spy = renders();
    await render(<Round />);
    const after = spy.mock.calls.length;
    await act(() => jest.advanceTimersByTime(500));
    await act(() => useGame.getState().gotIt());
    expect(spy.mock.calls.length).toBeGreaterThan(after);
  });
});
