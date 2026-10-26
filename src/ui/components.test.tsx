import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Text } from 'react-native';

import type { PackMeta } from '../../content/schema';
import type { Team } from '../engine/types';
import {
  AppText,
  Button,
  Card,
  Chip,
  Confetti,
  FuseBar,
  IconButton,
  PackTile,
  PhraseText,
  RangeSlider,
  ScoreRow,
  Screen,
  SearchField,
  Segmented,
  Stepper,
  TEAM_COLORS,
  TeamCard,
  TextField,
  ThemeProvider,
  ToggleRow,
  palette,
  useTheme,
} from './index';

const team = (over: Partial<Team> = {}): Team => ({
  id: 't1',
  name: 'Team Blue',
  color: TEAM_COLORS[0].hex,
  players: [],
  ...over,
});

const pack: PackMeta = {
  id: 'movies',
  name: 'Movie Night',
  emoji: '🎬',
  description: 'Films',
  tags: ['family', 'hard'],
  version: 1,
  phraseCount: 1234,
};

const a11yAction = (actionName: string) => ({ nativeEvent: { actionName } });

describe('theme', () => {
  function Probe() {
    const t = useTheme();
    return <Text testID="probe">{`${t.scheme}:${t.colors.background}:${t.reduceMotion}`}</Text>;
  }

  it('honors an explicit scheme and reduceMotion', async () => {
    await render(
      <ThemeProvider scheme="dark" reduceMotion>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent(`dark:${palette.dark.background}:true`);
  });

  it('Screen scheme gives children a nested theme', async () => {
    await render(
      <ThemeProvider scheme="light">
        <Screen scheme="dark" testID="scr">
          <Probe />
        </Screen>
      </ThemeProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent(/^dark:/);
    expect(screen.getByTestId('scr')).toHaveStyle({ backgroundColor: palette.dark.background });
  });

  it('Screen tint overrides the background and can scroll', async () => {
    await render(
      <Screen tint="#123456" scroll testID="scr">
        <Text>child</Text>
      </Screen>,
    );
    expect(screen.getByTestId('scr')).toHaveStyle({ backgroundColor: '#123456' });
    expect(screen.getByText('child')).toBeOnTheScreen();
  });
});

describe('AppText', () => {
  it('maps variants, marks headings and caps font scaling', async () => {
    await render(
      <>
        <AppText variant="title">Big</AppText>
        <AppText>Body</AppText>
      </>,
    );
    expect(screen.getByRole('header', { name: 'Big' })).toBeOnTheScreen();
    const body = screen.getByText('Body');
    expect(body).toHaveProp('allowFontScaling', true);
    expect(body).toHaveProp('maxFontSizeMultiplier', 2);
    expect(body).toHaveStyle({ fontFamily: 'Baloo2_500Medium', fontSize: 18 });
  });
});

describe('Button', () => {
  it('presses and exposes accessibility props', async () => {
    const onPress = jest.fn();
    await render(<Button label="Got it" icon="✅" onPress={onPress} accessibilityHint="Next phrase" />);
    const btn = screen.getByRole('button', { name: 'Got it' });
    expect(btn).toHaveProp('accessibilityHint', 'Next phrase');
    await fireEvent.press(btn);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled', async () => {
    const onPress = jest.fn();
    await render(<Button label="Start" disabled onPress={onPress} />);
    const btn = screen.getByRole('button', { name: 'Start' });
    expect(btn).toBeDisabled();
    await fireEvent.press(btn);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('debounces rapid presses', async () => {
    const onPress = jest.fn();
    const now = jest.spyOn(Date, 'now');
    await render(<Button label="Got it" debounceMs={300} onPress={onPress} />);
    const btn = screen.getByRole('button', { name: 'Got it' });
    now.mockReturnValue(1000);
    await fireEvent.press(btn);
    now.mockReturnValue(1100);
    await fireEvent.press(btn);
    now.mockReturnValue(1400);
    await fireEvent.press(btn);
    expect(onPress).toHaveBeenCalledTimes(2);
    now.mockRestore();
  });

  it('uses a readable label on a team color', async () => {
    await render(<Button label="Yellow" color={TEAM_COLORS[4].hex} onPress={() => {}} />);
    expect(screen.getByText('Yellow')).toHaveStyle({ color: TEAM_COLORS[4].text });
  });

  it('IconButton has a label, hint and long press', async () => {
    const onLongPress = jest.fn();
    await render(
      <IconButton
        icon="⏸"
        accessibilityLabel="Pause"
        accessibilityHint="Hold for host menu"
        onPress={() => {}}
        onLongPress={onLongPress}
      />,
    );
    const btn = screen.getByRole('button', { name: 'Pause' });
    expect(btn).toHaveProp('accessibilityHint', 'Hold for host menu');
    await fireEvent(btn, 'longPress');
    expect(onLongPress).toHaveBeenCalled();
  });
});

describe('PhraseText', () => {
  it('renders the phrase, sized from the measured box', async () => {
    await render(<PhraseText text="Pizza" testID="phrase" />);
    await fireEvent.layout(screen.getByTestId('phrase'), { width: 1000, height: 1000 });
    expect(screen.getByText('Pizza')).toHaveStyle({ fontSize: 96 });
  });

  it('keeps long phrases at or above 40', async () => {
    await render(<PhraseText text="Supercalifragilisticexpialidocious" testID="phrase" />);
    await fireEvent.layout(screen.getByTestId('phrase'), { width: 200, height: 100 });
    expect(screen.getByText('Supercalifragilisticexpialidocious')).toHaveStyle({ fontSize: 40 });
  });

  it('hides the phrase entirely when paused', async () => {
    await render(<PhraseText text="Secret" hidden testID="phrase" />);
    expect(screen.queryByText('Secret')).not.toBeOnTheScreen();
    expect(screen.getByLabelText(/Phrase hidden/)).toBeOnTheScreen();
  });
});

describe('Stepper', () => {
  function Harness({ start = 7 }: { start?: number }) {
    const [v, setV] = useState(start);
    return <Stepper label="Points" value={v} min={3} max={8} onChange={setV} testID="st" />;
  }

  it('increments, clamps at max and disables the button', async () => {
    await render(<Harness />);
    const inc = screen.getByLabelText('Increase Points');
    await fireEvent.press(inc);
    expect(screen.getByTestId('st-value')).toHaveTextContent('8');
    await fireEvent.press(inc);
    expect(screen.getByTestId('st-value')).toHaveTextContent('8');
    expect(inc).toBeDisabled();
  });

  it('clamps at min and supports accessibility actions', async () => {
    await render(<Harness start={4} />);
    const row = screen.getByTestId('st');
    expect(row).toHaveAccessibilityValue({ min: 3, max: 8, now: 4 });
    await fireEvent(row, 'accessibilityAction', a11yAction('decrement'));
    await fireEvent(row, 'accessibilityAction', a11yAction('decrement'));
    expect(screen.getByTestId('st-value')).toHaveTextContent('3');
    expect(screen.getByLabelText('Decrease Points')).toBeDisabled();
    await fireEvent(row, 'accessibilityAction', a11yAction('increment'));
    expect(screen.getByTestId('st-value')).toHaveTextContent('4');
  });
});

describe('RangeSlider', () => {
  function Harness({ low: l = 45, high: h = 75 }: { low?: number; high?: number }) {
    const [r, setR] = useState<[number, number]>([l, h]);
    return (
      <RangeSlider
        label="Fuse"
        min={20}
        max={120}
        step={5}
        low={r[0]}
        high={r[1]}
        onChange={(a, b) => setR([a, b])}
        format={(v) => `${v}s`}
        testID="rs"
      />
    );
  }

  it('shows the formatted range', async () => {
    await render(<Harness />);
    expect(screen.getByTestId('rs-value')).toHaveTextContent('45s – 75s');
    expect(screen.getByLabelText('Fuse, minimum')).toHaveAccessibilityValue({ now: 45, text: '45s' });
  });

  it('accessibility actions step thumbs and keep low <= high', async () => {
    await render(<Harness low={65} high={70} />);
    const lo = screen.getByTestId('rs-low');
    const hi = screen.getByTestId('rs-high');
    await fireEvent(lo, 'accessibilityAction', a11yAction('increment'));
    expect(screen.getByTestId('rs-value')).toHaveTextContent('70s');
    await fireEvent(lo, 'accessibilityAction', a11yAction('increment'));
    expect(screen.getByTestId('rs-value')).toHaveTextContent('70s');
    await fireEvent(hi, 'accessibilityAction', a11yAction('decrement'));
    expect(screen.getByTestId('rs-value')).toHaveTextContent('70s');
    await fireEvent(hi, 'accessibilityAction', a11yAction('increment'));
    expect(screen.getByTestId('rs-value')).toHaveTextContent('70s – 75s');
    await fireEvent(lo, 'accessibilityAction', a11yAction('decrement'));
    expect(screen.getByTestId('rs-value')).toHaveTextContent('65s – 75s');
  });
});

describe('Segmented', () => {
  it('selects options, including null values', async () => {
    const onChange = jest.fn();
    await render(
      <Segmented<number | null>
        label="Skips"
        options={[
          { value: 0, label: 'None' },
          { value: null, label: 'Unlimited' },
        ]}
        value={0}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('radio', { name: 'None' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Unlimited' })).not.toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: 'Unlimited' }));
    expect(onChange).toHaveBeenCalledWith(null);
    await fireEvent.press(screen.getByRole('radio', { name: 'None' }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('ignores presses when disabled', async () => {
    const onChange = jest.fn();
    await render(
      <Segmented
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
        value="a"
        onChange={onChange}
        disabled
      />,
    );
    const b = screen.getByRole('radio', { name: 'B' });
    expect(b).toBeDisabled();
    await fireEvent.press(b);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('ToggleRow', () => {
  it('toggles from anywhere on the row', async () => {
    const onChange = jest.fn();
    await render(
      <ToggleRow label="Chill mode" description="Show the fuse" value={false} onChange={onChange} testID="tg" />,
    );
    const sw = screen.getByRole('switch', { name: 'Chill mode' });
    expect(sw).not.toBeChecked();
    await fireEvent.press(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('respects disabled', async () => {
    const onChange = jest.fn();
    await render(<ToggleRow label="Sound" value onChange={onChange} disabled />);
    const sw = screen.getByRole('switch', { name: 'Sound' });
    expect(sw).toBeChecked();
    expect(sw).toBeDisabled();
    await fireEvent.press(sw);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Chip and Card', () => {
  it('chip toggles with selected state; static chips are not buttons', async () => {
    const onPress = jest.fn();
    await render(
      <>
        <Chip label="Family" selected onPress={onPress} />
        <Chip label="Tag" />
        <Chip label="Off" onPress={onPress} disabled />
        <Card testID="card">
          <Text>inside</Text>
        </Card>
      </>,
    );
    const fam = screen.getByRole('button', { name: 'Family' });
    expect(fam).toBeSelected();
    await fireEvent.press(fam);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Tag' })).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Off' })).toBeDisabled();
    expect(screen.getByText('inside')).toBeOnTheScreen();
  });
});

describe('PackTile', () => {
  it('is a checkbox that toggles and reports checked state', async () => {
    function Harness() {
      const [sel, setSel] = useState(false);
      return <PackTile pack={pack} selected={sel} onToggle={() => setSel((s) => !s)} testID="tile" />;
    }
    await render(<Harness />);
    const tile = screen.getByRole('checkbox');
    expect(tile).toHaveAccessibleName('Movie Night, 1,234 phrases, Family, Hard');
    expect(tile).not.toBeChecked();
    await fireEvent.press(tile);
    expect(screen.getByRole('checkbox')).toBeChecked();
    await fireEvent.press(screen.getByRole('checkbox'));
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });
});

describe('TeamCard', () => {
  function Harness({ used = [TEAM_COLORS[1].hex], showPlayers }: { used?: string[]; showPlayers?: boolean }) {
    const [t, setT] = useState(team({ players: ['Ada'] }));
    const [removed, setRemoved] = useState(false);
    return (
      <>
        <TeamCard
          team={t}
          index={0}
          canRemove
          usedColors={used}
          showPlayers={showPlayers}
          onChange={(patch) => setT((x) => ({ ...x, ...patch }))}
          onRemove={() => setRemoved(true)}
        />
        <Text testID="state">{JSON.stringify({ ...t, removed })}</Text>
      </>
    );
  }
  const state = () => JSON.parse(String(screen.getByTestId('state').props.children));

  it('edits the name', async () => {
    await render(<Harness />);
    await fireEvent.changeText(screen.getByLabelText('Team 1 name'), 'Rockets');
    expect(state().name).toBe('Rockets');
  });

  it('picks colors; colors used by other teams stay disabled', async () => {
    await render(<Harness />);
    expect(screen.getByRole('radio', { name: 'Blue' })).toBeChecked();
    const taken = screen.getByRole('radio', { name: 'Orange, taken by another team' });
    expect(taken).toBeDisabled();
    await fireEvent.press(taken);
    expect(state().color).toBe(TEAM_COLORS[0].hex);
    await fireEvent.press(screen.getByRole('radio', { name: 'Teal' }));
    expect(state().color).toBe(TEAM_COLORS[3].hex);
    expect(screen.getByRole('radio', { name: 'Teal' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Orange, taken by another team' })).toBeDisabled();
  });

  it('adds, edits and removes players, and removes the team', async () => {
    await render(<Harness />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add player to Team Blue' }));
    expect(state().players).toEqual(['Ada', '']);
    await fireEvent.changeText(screen.getByLabelText('Team Blue player 2 name'), 'Grace');
    expect(state().players).toEqual(['Ada', 'Grace']);
    await fireEvent.press(screen.getByRole('button', { name: 'Remove player 1, Ada' }));
    expect(state().players).toEqual(['Grace']);
    await fireEvent.press(screen.getByRole('button', { name: 'Remove Team Blue' }));
    expect(state().removed).toBe(true);
  });

  it('can hide the player editor', async () => {
    await render(<Harness showPlayers={false} />);
    expect(screen.queryByText('Players (optional)')).not.toBeOnTheScreen();
  });
});

describe('ScoreRow, FuseBar, Confetti, fields', () => {
  it('ScoreRow summarizes for screen readers and shows pips + delta', async () => {
    await render(<ScoreRow team={team()} score={3} target={7} delta={1} highlight testID="row" />);
    expect(screen.getByLabelText('Team Blue: 3 of 7 points, plus 1, leading')).toBeOnTheScreen();
    expect(screen.getAllByTestId('row-pip-on')).toHaveLength(3);
    expect(screen.getAllByTestId('row-pip-off')).toHaveLength(4);
    expect(screen.getByText('+1')).toBeOnTheScreen();
  });

  it('FuseBar is a progressbar of remaining fuse', async () => {
    await render(<FuseBar progress={0.25} testID="fuse" />);
    expect(screen.getByRole('progressbar', { name: 'Fuse' })).toHaveAccessibilityValue({ now: 75 });
    expect(screen.getByTestId('fuse-fill')).toHaveStyle({ width: '75%' });
  });

  it('Confetti renders particles when active and nothing with reduce motion', async () => {
    const onDone = jest.fn();
    const { rerender } = await render(<Confetti active count={12} testID="cf" />);
    expect(screen.getByTestId('cf', { includeHiddenElements: true })).toBeOnTheScreen();
    await rerender(
      <ThemeProvider reduceMotion>
        <Confetti active count={12} testID="cf" onDone={onDone} />
      </ThemeProvider>,
    );
    expect(screen.queryByTestId('cf', { includeHiddenElements: true })).not.toBeOnTheScreen();
    expect(onDone).toHaveBeenCalled();
  });

  it('Confetti is inactive by default', async () => {
    await render(<Confetti active={false} testID="cf" />);
    expect(screen.queryByTestId('cf', { includeHiddenElements: true })).not.toBeOnTheScreen();
  });

  it('TextField and SearchField edit text; search can be cleared', async () => {
    const onName = jest.fn();
    const onSearch = jest.fn();
    await render(
      <>
        <TextField label="Pack name" value="" onChangeText={onName} error="Required" />
        <SearchField value="cat" onChangeText={onSearch} placeholder="Search packs" />
      </>,
    );
    await fireEvent.changeText(screen.getByLabelText('Pack name'), 'Mine');
    expect(onName).toHaveBeenCalledWith('Mine');
    expect(screen.getByText('Required')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
    expect(onSearch).toHaveBeenCalledWith('');
  });
});
