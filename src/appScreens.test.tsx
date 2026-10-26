/**
 * Screen tests for app/ routes. They live in src/ because Expo Router turns every file under app/
 * (tests included) into a route.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Alert } from 'react-native';

import Caught from '../app/caught';
import Home from '../app/index';
import Scoreboard from '../app/scoreboard';
import Settings from '../app/settings';
import Setup from '../app/setup';
import Win from '../app/win';
import { createGame, reduce, type GameSettings, type GameState } from './engine';
import { useGame } from './store/game';
import { REVIEW_PROMPT_DELAY_MS, reviewPrompt } from './store/review';
import { useSettings } from './store/settings';
import { TEAM_COLORS } from './ui';

const teams = (n: number) =>
  ['Blue', 'Orange', 'Pink', 'Teal'].slice(0, n).map((name, i) => ({
    id: `team-${i + 1}`,
    name: `Team ${name}`,
    color: TEAM_COLORS[i].hex,
    players: [],
  }));

/** A real engine game: catch the given team indices in order, ending on the screen's phase. */
function gameAfter(teamCount: number, target: number, caught: number[], end: 'caught' | 'scoreboard'): GameState {
  let t = 1_000_000;
  let n = 0;
  const deps = {
    now: () => t,
    rng: () => 0,
    draw: () => ({ id: `p:${++n}`, text: `Phrase ${n}`, difficulty: 1 as const }),
  };
  const settings: GameSettings = {
    mode: 'classic',
    teams: teams(teamCount),
    packIds: ['test'],
    targetScore: target,
    skipsPerTurn: 1,
    fuseMinMs: 15_000,
    fuseMaxMs: 15_000,
    showFuse: false,
  };
  let s = reduce(createGame(settings), { type: 'START_ROUND' }, deps);
  caught.forEach((team, i) => {
    if (i > 0) s = reduce(s, { type: 'NEXT_ROUND' }, deps);
    while (s.holderTeamIndex !== team) {
      t += 500;
      s = reduce(s, { type: 'GOT_IT' }, deps);
    }
    t += 20_000;
    s = reduce(s, { type: 'TICK', now: t }, deps);
    if (i < caught.length - 1 || end === 'scoreboard') s = reduce(s, { type: 'SHOW_SCOREBOARD' }, deps);
  });
  return s;
}

afterEach(() => {
  useGame.setState({ game: null });
});

describe('Scoreboard: sudden death', () => {
  it('says the leaders are tied and play goes on when 3 teams tie at the target', async () => {
    // Team Blue caught: Orange 1, Pink 1, both at the target of 1.
    const game = gameAfter(3, 1, [0], 'scoreboard');
    expect(game.phase).toBe('scoreboard');
    useGame.setState({ game });
    await render(<Scoreboard />);
    expect(screen.getByTestId('scoreboard-sudden-death')).toBeTruthy();
    expect(screen.getByRole('header', { name: /Tied! Sudden death/ })).toBeTruthy();
    expect(
      screen.getByText('Team Orange and Team Pink are tied at 1. Keep playing: the first team to pull ahead wins.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /Sudden Death Round/ })).toBeTruthy();
  });

  it('lists three tied teams in a 4-team game', async () => {
    useGame.setState({ game: gameAfter(4, 1, [0], 'scoreboard') });
    await render(<Scoreboard />);
    expect(screen.getByText(/^Team Orange, Team Pink and Team Teal are tied at 1\./)).toBeTruthy();
  });

  it('shows no banner below the target or with a single leader', async () => {
    useGame.setState({ game: gameAfter(3, 3, [0], 'scoreboard') });
    await render(<Scoreboard />);
    expect(screen.queryByTestId('scoreboard-sudden-death')).toBeNull();
    expect(screen.getByRole('button', { name: /Next Round/ })).toBeTruthy();
  });
});

describe('Caught', () => {
  it('flags sudden death and crowns the leaders, not the caught team', async () => {
    useGame.setState({ game: gameAfter(3, 1, [0], 'caught') });
    await render(<Caught />);
    expect(screen.getByText('Team Blue got caught!')).toBeTruthy();
    expect(screen.getByTestId('caught-sudden-death')).toHaveTextContent(/sudden death/);
    expect(screen.getByTestId('caught-score-team-1').props.accessibilityLabel).not.toMatch(/leading/);
    expect(screen.getByTestId('caught-score-team-2').props.accessibilityLabel).toMatch(/leading/);
  });

  it('has no sudden-death line in a normal round', async () => {
    useGame.setState({ game: gameAfter(2, 7, [0], 'caught') });
    await render(<Caught />);
    expect(screen.queryByTestId('caught-sudden-death')).toBeNull();
  });
});

describe('Accessibility (F11): Home, Setup and Settings', () => {
  const INTERACTIVE = new Set(['button', 'switch', 'radio', 'checkbox', 'adjustable', 'search', 'link']);

  /**
   * Every interactive host element has an accessible name. (The aria-* mirrors that react-native-web
   * needs are folded back into accessibilityState by RN's host components, so they are checked in
   * src/ui/components.test.tsx and by the Playwright snapshot instead.)
   */
  function auditInteractive() {
    type Node = { type: unknown; props: Record<string, unknown>; children: (Node | string)[] };
    const hosts: Node[] = [];
    const walk = (n: Node | string) => {
      if (typeof n === 'string') return;
      const role = (n.props.accessibilityRole ?? n.props.role) as string | undefined;
      if (typeof n.type === 'string' && role && INTERACTIVE.has(role)) hosts.push(n);
      n.children.forEach(walk);
    };
    walk(screen.container as unknown as Node);
    expect(hosts.length).toBeGreaterThan(3);
    for (const n of hosts) {
      const role = n.props.accessibilityRole ?? n.props.role;
      const name = n.props.accessibilityLabel ?? n.props['aria-label'];
      expect({ role, testID: n.props.testID, named: typeof name === 'string' && name.trim().length > 0 }).toEqual({
        role,
        testID: n.props.testID,
        named: true,
      });
      if (role === 'adjustable') expect(typeof (n.props.accessibilityValue as { now?: unknown })?.now).toBe('number');
    }
  }

  beforeEach(() => {
    useSettings.getState().set('hasSeenTutorial', true);
  });

  it('Home: named buttons and a header', async () => {
    await render(<Home />);
    auditInteractive();
    expect(screen.getByRole('header', { name: 'Blurt!' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Quick Play' })).toBeTruthy();
  });

  it('Setup: every control is named; sections are headers; steppers and sliders are adjustable', async () => {
    await render(<Setup />);
    auditInteractive();
    for (const h of ['Custom Game', 'Teams', 'Seating', 'Rules', 'Packs']) {
      expect(screen.getByRole('header', { name: h })).toBeTruthy();
    }
    expect(screen.getByRole('adjustable', { name: 'Points to win' })).toBeTruthy();
    expect(screen.getByRole('adjustable', { name: /fuse length.*minimum/ })).toBeTruthy();
  });

  it('Settings: every control is named; toggles expose checked; notices are announced', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await render(<Settings />);
    auditInteractive();
    for (const h of ['Settings', 'Sound & haptics', 'Buzzer', 'Default rules', 'Content', 'Help']) {
      expect(screen.getByRole('header', { name: h })).toBeTruthy();
    }
    const sound = screen.getByRole('switch', { name: 'Sound' });
    expect(sound).toBeChecked();
    // Volume is disabled (not just dimmed) while sound is off.
    await fireEvent.press(sound);
    expect(screen.getByRole('radio', { name: '50%' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('switch', { name: 'Sound' }));
    // Confirm the native alert by pressing its destructive button.
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    await fireEvent.press(screen.getByRole('button', { name: /Reset phrase history/ }));
    expect(announce).toHaveBeenCalledWith('Phrase history cleared.');
    jest.restoreAllMocks();
  });
});

// Last on purpose: it runs under fake timers, which can stall the cleanup of later tests.
describe('Win: review prompt', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(async () => {
    // Flush timers queued under fake time (animations, React scheduling) before going back to
    // real time, or the next test's cleanup waits on them forever.
    await act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });

  it('asks the review prompt after the confetti, and not if the screen is left first', async () => {
    const ask = jest.spyOn(reviewPrompt, 'maybeRequestReview').mockResolvedValue(false);
    const game = gameAfter(2, 1, [0], 'scoreboard');
    expect(game.phase).toBe('won');
    useGame.setState({ game });
    const view = await render(<Win />);
    expect(screen.getByText('Team Orange wins!')).toBeTruthy();
    expect(ask).not.toHaveBeenCalled();
    await act(() => jest.advanceTimersByTime(REVIEW_PROMPT_DELAY_MS));
    expect(ask).toHaveBeenCalledTimes(1);
    await view.unmount();

    ask.mockClear();
    const again = await render(<Win />);
    await again.unmount();
    jest.advanceTimersByTime(REVIEW_PROMPT_DELAY_MS * 2);
    expect(ask).not.toHaveBeenCalled();
    ask.mockRestore();
  });
});
