/**
 * Screen tests for app/ routes. They live in src/ because Expo Router turns every file under app/
 * (tests included) into a route.
 */
import { act, render, screen } from '@testing-library/react-native';

import Caught from '../app/caught';
import Scoreboard from '../app/scoreboard';
import Win from '../app/win';
import { createGame, reduce, type GameSettings, type GameState } from './engine';
import { useGame } from './store/game';
import { REVIEW_PROMPT_DELAY_MS, reviewPrompt } from './store/review';
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

describe('Win: review prompt', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

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
