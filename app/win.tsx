import { useEffect } from 'react';
import { View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import type { GameState } from '../src/engine/types';
import { useGame } from '../src/store/game';
import { REVIEW_PROMPT_DELAY_MS, reviewPrompt } from '../src/store/review';
import { AppText, Button, Card, Confetti, Screen, ScoreRow, useTheme } from '../src/ui';

interface StatLine {
  key: string;
  label: string;
  value: string;
}

/** P1 game stats, derived from roundLog and stats; empty when there is nothing to show. */
function gameStats(game: GameState): StatLine[] {
  const teamName = (id: string) => game.settings.teams.find((t) => t.id === id)?.name ?? 'Unknown team';
  const lines: StatLine[] = [];

  const caught = new Map<string, number>();
  for (const entry of game.roundLog) {
    const who = entry.caughtPlayer
      ? `${entry.caughtPlayer} (${teamName(entry.caughtTeamId)})`
      : teamName(entry.caughtTeamId);
    caught.set(who, (caught.get(who) ?? 0) + 1);
  }
  if (caught.size > 0) {
    const [who, n] = [...caught.entries()].sort((a, b) => b[1] - a[1])[0];
    lines.push({ key: 'caught', label: 'Caught holding the bomb most', value: `${who}, ${n}×` });
  }

  const fastest = game.stats?.fastest;
  if (fastest) {
    const who = fastest.player ? `${fastest.player} (${teamName(fastest.teamId)})` : teamName(fastest.teamId);
    lines.push({ key: 'fastest', label: 'Fastest guess', value: `${who}, ${(fastest.ms / 1000).toFixed(1)}s` });
  }

  const gotIt = Object.entries(game.stats?.gotIt ?? {}).sort((a, b) => b[1] - a[1]);
  if (gotIt.length > 0 && gotIt[0][1] > 0) {
    lines.push({ key: 'gotit', label: 'Most phrases guessed', value: `${teamName(gotIt[0][0])}, ${gotIt[0][1]}` });
  }
  return lines;
}

export default function Win() {
  const { colors, spacing } = useTheme();
  const game = useGame((s) => s.game);
  const { playAgain, quitGame, undoLastPoint } = useGame(
    useShallow((s) => ({ playAgain: s.playAgain, quitGame: s.quitGame, undoLastPoint: s.undoLastPoint })),
  );

  const won = game?.phase === 'won';

  // In-app review (PRD 11): only here, at most once per 3 completed games; never on web.
  useEffect(() => {
    if (!won) return;
    const timer = setTimeout(() => void reviewPrompt.maybeRequestReview(), REVIEW_PROMPT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [won]);

  if (!game) return null;

  const { teams, targetScore } = game.settings;
  const ranked = [...teams].sort((a, b) => (game.scores[b.id] ?? 0) - (game.scores[a.id] ?? 0));
  const winner = teams.find((t) => t.id === game.winnerTeamId) ?? ranked[0];
  const stats = gameStats(game);

  return (
    <Screen scroll testID="win-screen">
      <Confetti active />
      <View style={{ gap: spacing.lg, paddingVertical: spacing.lg }}>
        <View style={{ alignItems: 'center', gap: spacing.xs }}>
          <AppText variant="display" align="center" decorative>
            🏆
          </AppText>
          <AppText variant="display" align="center" accessibilityRole="header" testID="win-headline">
            {winner?.name ?? 'Nobody'} wins!
          </AppText>
          <AppText variant="body" align="center" color={colors.textMuted}>
            First to {targetScore} points
          </AppText>
        </View>

        <Card color={winner?.color}>
          <View style={{ gap: spacing.sm }}>
            <AppText variant="heading" accessibilityRole="header">
              Final scores
            </AppText>
            {ranked.map((team) => (
              <ScoreRow
                key={team.id}
                team={team}
                score={game.scores[team.id] ?? 0}
                target={targetScore}
                highlight={team.id === winner?.id}
                testID={`win-score-${team.id}`}
              />
            ))}
          </View>
        </Card>

        {stats.length > 0 ? (
          <Card testID="win-stats">
            <View style={{ gap: spacing.sm }}>
              <AppText variant="heading" accessibilityRole="header">
                Game stats
              </AppText>
              {stats.map((s) => (
                <View key={s.key}>
                  <AppText variant="label" color={colors.textMuted}>
                    {s.label}
                  </AppText>
                  <AppText variant="body">{s.value}</AppText>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        <Button
          label="Play Again"
          icon="🔁"
          size="xl"
          variant="primary"
          fullWidth
          onPress={playAgain}
          accessibilityHint="Same teams, packs and rules"
          testID="win-play-again"
        />
        <Button label="Home" icon="🏠" variant="secondary" fullWidth onPress={quitGame} testID="win-home" />
        <Button
          label="Oops, undo last point"
          variant="ghost"
          size="sm"
          fullWidth
          disabled={game.roundLog.length === 0}
          onPress={undoLastPoint}
          testID="win-undo"
        />
      </View>
    </Screen>
  );
}
