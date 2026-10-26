import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, View } from 'react-native';

import { audioService } from '../src/audio';
import { APP_NAME, APP_VERSION, LIMITS, SHIP_AFTER_DARK } from '../src/config';
import { contentService } from '../src/content';
import { useSettings } from '../src/store/settings';
import {
  AppText,
  Button,
  Card,
  Chip,
  IconButton,
  RangeSlider,
  Screen,
  Segmented,
  Stepper,
  ToggleRow,
  useTheme,
} from '../src/ui';

/** Native alert on iOS/Android; window.confirm on web (react-native-web's Alert is a no-op). */
function confirm(title: string, message: string, yes: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: yes, style: 'destructive', onPress: onYes },
  ]);
}

const VOLUMES = [
  { value: 0.25, label: '25%' },
  { value: 0.5, label: '50%' },
  { value: 0.75, label: '75%' },
  { value: 1, label: '100%' },
];
const skipLabel = (v: number | null) => (v === null ? 'Unlimited' : String(v));
const secs = (ms: number) => Math.round(ms / 1000);
const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

export default function Settings() {
  const { colors, spacing } = useTheme();
  const s = useSettings();
  const buzzers = useMemo(() => [{ id: 'random', name: 'Random' }, ...audioService.listBuzzers()], []);
  const [notice, setNotice] = useState<string | null>(null);
  const r = s.defaultRules;

  const pickBuzzer = (id: string) => {
    s.set('buzzerId', id);
    audioService.playBuzzer(id); // preview
  };

  const toggleAfterDark = (on: boolean) => {
    if (!on) {
      s.set('afterDarkEnabled', false);
      return;
    }
    confirm(
      'Turn on After Dark?',
      'After Dark packs have adult (18+) humor. They stay out of Quick Play. Only turn this on if everyone playing is 18 or older.',
      "I'm 18+, turn on",
      () => s.set('afterDarkEnabled', true),
    );
  };

  const section = (title: string) => (
    <AppText variant="heading" accessibilityRole="header" style={{ marginTop: spacing.md }}>
      {title}
    </AppText>
  );

  return (
    <Screen testID="settings-screen">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <IconButton icon="←" accessibilityLabel="Back" onPress={goBack} testID="settings-back" />
        <AppText variant="title" accessibilityRole="header">
          Settings
        </AppText>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }}>
        {section('Sound & haptics')}
        <Card>
          <View style={{ gap: spacing.md }}>
            <ToggleRow
              label="Sound"
              value={s.soundEnabled}
              onChange={(v) => s.set('soundEnabled', v)}
              testID="settings-sound"
            />
            <Segmented<number>
              label="Volume"
              options={VOLUMES}
              value={s.volume}
              onChange={(v) => s.set('volume', v)}
              testID="settings-volume"
            />
            <ToggleRow
              label="Haptics"
              description="Buzz the phone with the ticking fuse."
              value={s.hapticsEnabled}
              onChange={(v) => s.set('hapticsEnabled', v)}
              testID="settings-haptics"
            />
            <ToggleRow
              label="Respect silent switch"
              description="Off: the game plays sound even when your phone is on silent."
              value={s.respectSilentMode}
              onChange={(v) => s.set('respectSilentMode', v)}
              testID="settings-silent"
            />
          </View>
        </Card>

        {section('Buzzer')}
        <Card>
          <View style={{ gap: spacing.sm }}>
            <AppText variant="caption" color={colors.textMuted}>
              Tap a buzzer to hear it. Selected: {buzzers.find((b) => b.id === s.buzzerId)?.name ?? 'Random'}
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {buzzers.map((b) => (
                <Chip
                  key={b.id}
                  label={b.id === 'random' ? '🎲 Random' : b.name}
                  selected={s.buzzerId === b.id}
                  onPress={() => pickBuzzer(b.id)}
                  testID={`settings-buzzer-${b.id}`}
                />
              ))}
            </View>
          </View>
        </Card>

        {section('Default rules')}
        <Card>
          <View style={{ gap: spacing.md }}>
            <AppText variant="caption" color={colors.textMuted}>
              Used for Quick Play and every new Custom Game.
            </AppText>
            <Stepper
              label="Points to win"
              value={r.targetScore}
              min={LIMITS.minTargetScore}
              max={LIMITS.maxTargetScore}
              onChange={(targetScore) => s.setDefaultRules({ targetScore })}
              testID="settings-target"
            />
            <Segmented<number | null>
              label="Skips per turn"
              options={LIMITS.skipChoices.map((v) => ({ value: v, label: skipLabel(v) }))}
              value={r.skipsPerTurn}
              onChange={(skipsPerTurn) => s.setDefaultRules({ skipsPerTurn })}
              testID="settings-skips"
            />
            <RangeSlider
              label="Hidden fuse length (seconds)"
              min={secs(LIMITS.fuseFloorMs)}
              max={secs(LIMITS.fuseCeilMs)}
              step={5}
              low={secs(r.fuseMinMs)}
              high={secs(r.fuseMaxMs)}
              onChange={(low, high) => s.setDefaultRules({ fuseMinMs: low * 1000, fuseMaxMs: high * 1000 })}
              format={(v) => `${v}s`}
              testID="settings-fuse"
            />
            <ToggleRow
              label="Chill mode"
              description="Show the fuse on screen. Great for kids."
              value={r.showFuse}
              onChange={(showFuse) => s.setDefaultRules({ showFuse })}
              testID="settings-chill"
            />
          </View>
        </Card>

        {section('Content')}
        <Card>
          <View style={{ gap: spacing.md }}>
            {SHIP_AFTER_DARK ? (
              <ToggleRow
                label="After Dark (18+)"
                description="Show adult packs in the pack picker. Never used in Quick Play."
                value={s.afterDarkEnabled}
                onChange={toggleAfterDark}
                testID="settings-after-dark"
              />
            ) : null}
            <Button
              label="Reset phrase history"
              icon="🧹"
              variant="secondary"
              fullWidth
              accessibilityHint="Lets phrases you've already seen come back"
              onPress={() =>
                confirm(
                  'Reset phrase history?',
                  "Phrases you've already played can show up again in every pack.",
                  'Reset',
                  () => {
                    contentService.resetHistory();
                    setNotice('Phrase history cleared.');
                  },
                )
              }
              testID="settings-reset-history"
            />
            <Button
              label="Reset all settings"
              icon="♻️"
              variant="danger"
              fullWidth
              accessibilityHint="Restores every setting to its default. Phrase history is kept."
              onPress={() =>
                confirm('Reset all settings?', 'Every setting goes back to its default.', 'Reset', () => {
                  s.resetAll();
                  setNotice('Settings restored to defaults.');
                })
              }
              testID="settings-reset-all"
            />
            {notice ? (
              <AppText variant="caption" color={colors.success} accessibilityRole="summary" testID="settings-notice">
                ✓ {notice}
              </AppText>
            ) : null}
          </View>
        </Card>

        {section('Help')}
        <Button
          label="How to Play"
          icon="❓"
          variant="secondary"
          fullWidth
          onPress={() => router.push('/how-to-play')}
          testID="settings-how-to-play"
        />

        <AppText variant="caption" align="center" color={colors.textMuted} testID="settings-version">
          {APP_NAME} v{APP_VERSION} · Every pack free. No ads, no accounts, works offline.
        </AppText>
      </ScrollView>
    </Screen>
  );
}
