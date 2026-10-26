import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { PackMeta } from '../../content/schema';
import type { Team } from '../engine/types';
import { AppText } from './AppText';
import { Button, IconButton } from './Button';
import { Card, Chip } from './Card';
import { Confetti } from './Confetti';
import { Segmented, Stepper, ToggleRow } from './Controls';
import { FuseBar } from './FuseBar';
import { PackTile } from './PackTile';
import { PhraseText } from './PhraseText';
import { RangeSlider } from './RangeSlider';
import { ScoreRow } from './ScoreRow';
import { TeamCard } from './TeamCard';
import { SearchField, TextField } from './TextField';
import { TEAM_COLORS, palette, spacing, type ColorScheme } from './tokens';
import { ThemeProvider, useTheme } from './theme';
import type { GalleryProps } from './types';

const SAMPLE_PACKS: PackMeta[] = [
  {
    id: 'movies',
    name: 'Movie Night',
    emoji: '🎬',
    description: 'Blockbusters, classics and cult hits.',
    tags: ['family'],
    version: 1,
    phraseCount: 412,
  },
  {
    id: 'hard-science',
    name: 'Big Brain Science',
    emoji: '🧪',
    description: 'For the know-it-alls.',
    tags: ['hard', 'family'],
    version: 1,
    phraseCount: 1250,
  },
];

const SAMPLE_PHRASES = ['Pizza', 'Hot air balloon', 'The Great Wall of China', 'Supercalifragilistic'];

const initialTeams = (): Team[] => [
  { id: 'a', name: 'Team Blue', color: TEAM_COLORS[0].hex, players: ['Ada', 'Grace'] },
  { id: 'b', name: 'Team Orange', color: TEAM_COLORS[1].hex, players: [] },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="heading">{title}</AppText>
      {children}
    </View>
  );
}

/** Every component with sample data, inside one forced scheme. */
function GallerySheet() {
  const { colors, scheme } = useTheme();
  const [count, setCount] = useState(7);
  const [range, setRange] = useState<[number, number]>([45, 75]);
  const [skips, setSkips] = useState<number | null>(1);
  const [chill, setChill] = useState(false);
  const [teams, setTeams] = useState(initialTeams);
  const [picked, setPicked] = useState<string[]>(['movies']);
  const [chip, setChip] = useState(true);
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [phrase, setPhrase] = useState(0);
  const [paused, setPaused] = useState(false);
  const [fuse, setFuse] = useState(0.35);
  const [confetti, setConfetti] = useState(false);
  const [presses, setPresses] = useState(0);

  const used = (id: string) => teams.filter((t) => t.id !== id).map((t) => t.color);

  return (
    <View
      testID={`gallery-${scheme}`}
      style={{ backgroundColor: colors.background, padding: spacing.md, gap: spacing.xl }}
    >
      <AppText variant="display">{scheme === 'dark' ? 'Dark' : 'Light'}</AppText>

      <Section title="Type">
        <AppText variant="display">Display</AppText>
        <AppText variant="title">Title</AppText>
        <AppText variant="heading">Heading</AppText>
        <AppText variant="body">Body text scales with the system font size.</AppText>
        <AppText variant="label">Label</AppText>
        <AppText variant="caption">Caption, muted</AppText>
      </Section>

      <Section title="Buttons">
        <Button
          label={`Got it (${presses})`}
          size="xl"
          fullWidth
          icon="✅"
          debounceMs={300}
          onPress={() => setPresses((n) => n + 1)}
        />
        <Button label="Primary" onPress={() => {}} />
        <Button label="Secondary" variant="secondary" onPress={() => {}} />
        <Button label="Danger" variant="danger" size="sm" onPress={() => {}} />
        <Button label="Ghost" variant="ghost" onPress={() => {}} />
        <Button label="Disabled" disabled onPress={() => {}} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {TEAM_COLORS.map((c) => (
            <Button key={c.hex} label={c.name} color={c.hex} size="sm" onPress={() => {}} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          <IconButton icon="⏸" accessibilityLabel="Pause" size="sm" onPress={() => {}} />
          <IconButton icon="⚙️" accessibilityLabel="Settings" onPress={() => {}} />
          <IconButton
            icon="⋯"
            accessibilityLabel="Host menu"
            size="lg"
            delayLongPress={800}
            onPress={() => {}}
            onLongPress={() => {}}
          />
        </View>
      </Section>

      <Section title="PhraseText">
        <View
          style={{
            height: 260,
            borderRadius: 24,
            overflow: 'hidden',
            backgroundColor: scheme === 'dark' ? TEAM_COLORS[0].deep : colors.surfaceAlt,
            padding: spacing.md,
          }}
        >
          <PhraseText
            text={SAMPLE_PHRASES[phrase]}
            hidden={paused}
            color={scheme === 'dark' ? palette.dark.text : undefined}
            testID={`gallery-${scheme}-phrase`}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Button
            label="Next phrase"
            size="sm"
            variant="secondary"
            onPress={() => setPhrase((i) => (i + 1) % SAMPLE_PHRASES.length)}
          />
          <Button label={paused ? 'Resume' : 'Pause'} size="sm" variant="ghost" onPress={() => setPaused((p) => !p)} />
        </View>
      </Section>

      <Section title="Team cards">
        {teams.map((t, i) => (
          <TeamCard
            key={t.id}
            team={t}
            index={i}
            canRemove={teams.length > 1}
            usedColors={used(t.id)}
            onChange={(patch) => setTeams((ts) => ts.map((x) => (x.id === t.id ? { ...x, ...patch } : x)))}
            onRemove={() => setTeams((ts) => ts.filter((x) => x.id !== t.id))}
          />
        ))}
      </Section>

      <Section title="Pack tiles">
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {SAMPLE_PACKS.map((p) => (
            <View key={p.id} style={{ flex: 1 }}>
              <PackTile
                pack={p}
                selected={picked.includes(p.id)}
                onToggle={() =>
                  setPicked((ids) => (ids.includes(p.id) ? ids.filter((x) => x !== p.id) : [...ids, p.id]))
                }
              />
            </View>
          ))}
        </View>
      </Section>

      <Section title="Controls">
        <Stepper label="Points to win" value={count} min={3} max={15} onChange={setCount} />
        <RangeSlider
          label="Hidden fuse length"
          min={20}
          max={120}
          step={5}
          low={range[0]}
          high={range[1]}
          onChange={(l, h) => setRange([l, h])}
          format={(v) => `${v}s`}
        />
        <Segmented<number | null>
          label="Skips per turn"
          options={[
            { value: 0, label: 'None' },
            { value: 1, label: '1' },
            { value: 3, label: '3' },
            { value: null, label: '∞' },
          ]}
          value={skips}
          onChange={setSkips}
        />
        <ToggleRow label="Chill mode" description="Show the fuse on screen." value={chill} onChange={setChill} />
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Chip label="Family" icon="👪" selected={chip} onPress={() => setChip((c) => !c)} />
          <Chip label="Hard" onPress={() => {}} />
          <Chip label="Static tag" />
        </View>
      </Section>

      <Section title="Fields">
        <TextField label="Pack name" value={name} onChangeText={setName} placeholder="My pack" maxLength={24} />
        <TextField label="With error" value="" onChangeText={() => {}} error="Give it a name" />
        <SearchField value={query} onChangeText={setQuery} placeholder="Search packs" />
      </Section>

      <Section title="Cards & scores">
        <Card>
          <AppText>Plain card</AppText>
        </Card>
        <ScoreRow team={teams[0] ?? initialTeams()[0]} score={5} target={7} highlight />
        <ScoreRow team={initialTeams()[1]} score={3} target={7} delta={1} />
        <ScoreRow
          team={{ id: 'c', name: 'Team Teal', color: TEAM_COLORS[3].hex, players: [] }}
          score={12}
          target={21}
        />
      </Section>

      <Section title="Fuse (chill mode)">
        <FuseBar progress={fuse} />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button label="Burn" size="sm" variant="secondary" onPress={() => setFuse((f) => Math.min(1, f + 0.15))} />
          <Button label="Relight" size="sm" variant="ghost" onPress={() => setFuse(0)} />
        </View>
      </Section>

      <Section title="Confetti">
        <View style={{ height: 200, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.surface }}>
          <Confetti active={confetti} onDone={() => setConfetti(false)} />
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Button label="Celebrate" icon="🎉" onPress={() => setConfetti(true)} />
          </View>
        </View>
      </Section>
    </View>
  );
}

/** Storybook-style gallery of every design-system component, in light and/or dark. */
export function Gallery({ initialScheme = 'both' }: GalleryProps = {}) {
  const [mode, setMode] = useState<ColorScheme | 'both'>(initialScheme);
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} testID="gallery">
      <View style={{ padding: spacing.md, gap: spacing.sm }}>
        <AppText variant="title">Blurt! UI</AppText>
        <Segmented<ColorScheme | 'both'>
          label="Scheme"
          options={[
            { value: 'both', label: 'Both' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
          value={mode}
          onChange={setMode}
          testID="gallery-scheme"
        />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled">
        {mode !== 'dark' ? (
          <ThemeProvider scheme="light">
            <GallerySheet />
          </ThemeProvider>
        ) : null}
        {mode !== 'light' ? (
          <ThemeProvider scheme="dark">
            <GallerySheet />
          </ThemeProvider>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
