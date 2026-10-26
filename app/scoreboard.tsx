import { useEffect } from 'react';
import { AccessibilityInfo, Alert, Platform, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { suddenDeath } from '../src/engine';
import { useGame } from '../src/store/game';
import { AppText, Button, Card, Screen, ScoreRow, useTheme } from '../src/ui';

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

/** "A", "A and B", "A, B and C". */
function joinNames(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export default function Scoreboard() {
  const { colors, spacing } = useTheme();
  const game = useGame((s) => s.game);
  const { nextRound, undoLastPoint, quitGame } = useGame(
    useShallow((s) => ({ nextRound: s.nextRound, undoLastPoint: s.undoLastPoint, quitGame: s.quitGame })),
  );

  const tie = game ? suddenDeath(game) : null;
  const tiedNames =
    tie && game ? joinNames(game.settings.teams.filter((t) => tie.teamIds.includes(t.id)).map((t) => t.name)) : '';
  const tieMessage = tie
    ? `${tiedNames} are tied at ${tie.score}. Keep playing: the first team to pull ahead wins.`
    : '';

  useEffect(() => {
    if (tieMessage) AccessibilityInfo.announceForAccessibility?.(`Tied! Sudden death. ${tieMessage}`);
  }, [tieMessage]);

  if (!game) return null;

  const { teams, targetScore } = game.settings;
  const best = Math.max(...teams.map((t) => game.scores[t.id] ?? 0));
  const canUndo = game.roundLog.length > 0;

  return (
    <Screen scroll testID="scoreboard-screen">
      <View style={{ gap: spacing.lg, paddingVertical: spacing.md }}>
        <View style={{ gap: spacing.xs }}>
          <AppText variant="title" align="center" accessibilityRole="header">
            Scoreboard
          </AppText>
          <AppText variant="body" align="center" color={colors.textMuted}>
            After round {game.round} · first to {targetScore} wins
          </AppText>
        </View>

        {tie ? (
          <Card color={colors.danger} testID="scoreboard-sudden-death">
            <View style={{ gap: spacing.xs }}>
              <AppText variant="heading" align="center" accessibilityRole="header">
                🔥 Tied! Sudden death
              </AppText>
              <AppText variant="body" align="center">
                {tieMessage}
              </AppText>
            </View>
          </Card>
        ) : null}

        <Card>
          <View style={{ gap: spacing.sm }}>
            {teams.map((team) => {
              const score = game.scores[team.id] ?? 0;
              return (
                <ScoreRow
                  key={team.id}
                  team={team}
                  score={score}
                  target={targetScore}
                  highlight={best > 0 && score === best}
                  testID={`scoreboard-score-${team.id}`}
                />
              );
            })}
          </View>
        </Card>

        <Button
          label={tie ? 'Sudden Death Round' : 'Next Round'}
          icon="🔥"
          size="xl"
          variant="primary"
          fullWidth
          onPress={nextRound}
          testID="scoreboard-next"
        />
        <Button
          label="Undo last point"
          icon="↩️"
          variant="secondary"
          fullWidth
          disabled={!canUndo}
          onPress={undoLastPoint}
          accessibilityHint={canUndo ? 'Takes back the points from the last fuse' : 'Nothing to undo yet'}
          testID="scoreboard-undo"
        />
        <Button
          label="Quit game"
          icon="🚪"
          variant="ghost"
          fullWidth
          onPress={() => confirm('Quit this game?', 'Scores will be lost.', 'Quit', quitGame)}
          testID="scoreboard-quit"
        />
      </View>
    </Screen>
  );
}
