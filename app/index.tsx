import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import { APP_NAME } from '../src/config';
import { useGame } from '../src/store/game';
import { useSettings } from '../src/store/settings';
import { AppText, Button, Screen, useTheme } from '../src/ui';

export default function Home() {
  const { colors, spacing } = useTheme();
  const quickPlay = useGame((s) => s.quickPlay);
  // Quick Play uses the saved default rules (Settings > Default rules).
  const target = useSettings((s) => s.defaultRules.targetScore);
  const tutorialShown = useRef(false);

  // First launch only: show How to Play once (skippable); it sets hasSeenTutorial when dismissed.
  // Checked on mount, so resetting settings later doesn't yank the user out of Settings.
  useEffect(() => {
    if (tutorialShown.current || useSettings.getState().hasSeenTutorial) return;
    tutorialShown.current = true;
    router.push('/how-to-play');
  }, []);

  return (
    <Screen scroll testID="home-screen">
      <View style={{ flexGrow: 1, justifyContent: 'center', gap: spacing.lg, paddingVertical: spacing.xl }}>
        <View style={{ alignItems: 'center', gap: spacing.xs }}>
          <AppText variant="display" align="center" accessibilityRole="header" testID="home-title">
            {APP_NAME}
          </AppText>
          <AppText variant="body" align="center" color={colors.textMuted}>
            Describe it. Shout it. Pass it before it blows.
          </AppText>
        </View>

        <View style={{ gap: spacing.xs }}>
          {/* Quick Play starts round 1 itself; the root layout follows the phase to /round. */}
          <Button
            label="Quick Play"
            icon="⚡"
            size="xl"
            variant="primary"
            fullWidth
            onPress={quickPlay}
            accessibilityHint={`Starts a game right away: 2 teams, all family packs, first to ${target} points`}
            testID="home-quick-play"
          />
          <AppText variant="caption" align="center" color={colors.textMuted}>
            2 teams · all family packs · first to {target}
          </AppText>
        </View>

        <Button
          label="Custom Game"
          icon="🎛️"
          size="lg"
          variant="secondary"
          fullWidth
          onPress={() => router.push('/setup')}
          accessibilityHint="Pick teams, packs and rules"
          testID="home-custom-game"
        />

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button
              label="How to Play"
              icon="❓"
              variant="ghost"
              fullWidth
              onPress={() => router.push('/how-to-play')}
              testID="home-how-to-play"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label="Settings"
              icon="⚙️"
              variant="ghost"
              fullWidth
              onPress={() => router.push('/settings')}
              testID="home-settings"
            />
          </View>
        </View>
      </View>
    </Screen>
  );
}
