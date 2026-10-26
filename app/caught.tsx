import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, StyleSheet, View } from 'react-native';

import { suddenDeath } from '../src/engine';
import { useGame } from '../src/store/game';
import { AppText, Button, Card, findTeamColor, palette, Screen, ScoreRow, spacing, useTheme } from '../src/ui';

const dark = palette.dark;

export default function Caught() {
  const { reduceMotion } = useTheme();
  const game = useGame((s) => s.game);
  const showScoreboard = useGame((s) => s.showScoreboard);
  const [flash] = useState(() => new Animated.Value(reduceMotion ? 0 : 1));

  const last = game?.roundLog[game.roundLog.length - 1];
  const caughtTeam = game?.settings.teams.find((t) => t.id === last?.caughtTeamId);
  const who = caughtTeam
    ? last?.caughtPlayer
      ? `${last.caughtPlayer} (${caughtTeam.name})`
      : caughtTeam.name
    : 'Someone';
  const headline = `${who} got caught!`;
  const tied = game ? suddenDeath(game) !== null : false;

  // Full-screen flash, then settle on the caught team's color.
  useEffect(() => {
    if (reduceMotion) return;
    const anim = Animated.timing(flash, { toValue: 0, duration: 600, useNativeDriver: Platform.OS !== 'web' });
    anim.start();
    return () => anim.stop();
  }, [flash, reduceMotion]);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility?.(tied ? `${headline} Tied at the top: sudden death!` : headline);
  }, [headline, tied]);

  if (!game) return null;

  const target = game.settings.targetScore;
  const best = Math.max(...game.settings.teams.map((t) => game.scores[t.id] ?? 0));

  return (
    <Screen
      scheme="dark"
      tint={caughtTeam ? (findTeamColor(caughtTeam.color)?.deep ?? caughtTeam.color) : undefined}
      testID="caught-screen"
    >
      <StatusBar style="light" />
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.lg }}>
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <AppText variant="display" align="center" color={dark.text} decorative>
            💥
          </AppText>
          <AppText
            variant="display"
            align="center"
            color={dark.text}
            accessibilityRole="header"
            testID="caught-headline"
          >
            {headline}
          </AppText>
          <AppText variant="body" align="center" color={dark.text}>
            {game.settings.teams.length === 2 ? 'The other team scores!' : 'Every other team scores!'}
          </AppText>
          {tied ? (
            <AppText variant="heading" align="center" color={dark.text} testID="caught-sudden-death">
              🔥 Tied at the top: sudden death!
            </AppText>
          ) : null}
        </View>

        <Card>
          <View style={{ gap: spacing.sm }}>
            {game.settings.teams.map((team) => {
              const scored = team.id !== last?.caughtTeamId;
              return (
                <ScoreRow
                  key={team.id}
                  team={team}
                  score={game.scores[team.id] ?? 0}
                  target={target}
                  highlight={best > 0 && (game.scores[team.id] ?? 0) === best}
                  delta={scored && last ? 1 : undefined}
                  testID={`caught-score-${team.id}`}
                />
              );
            })}
          </View>
        </Card>
      </View>

      <Button
        label="Continue"
        icon="➡️"
        size="xl"
        variant="primary"
        fullWidth
        onPress={showScoreboard}
        testID="caught-continue"
      />

      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF', opacity: flash }]}
      />
    </Screen>
  );
}
