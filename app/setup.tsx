import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { LIMITS } from '../src/config';
import { contentService } from '../src/content';
import type { Team } from '../src/engine/types';
import { useGame } from '../src/store/game';
import { useSettings } from '../src/store/settings';
import {
  AppText,
  Button,
  Card,
  IconButton,
  RangeSlider,
  Screen,
  Segmented,
  Stepper,
  TeamCard,
  ToggleRow,
  useTheme,
} from '../src/ui';

interface Seat {
  key: string;
  label: string;
  team: Team;
}

/**
 * Seat-order helper: who sits where so teams alternate around the circle. Uses player names when
 * any are entered (round-robin across teams), otherwise a generic pattern with two seats per team.
 */
function seatOrder(teams: Team[]): { seats: Seat[]; uneven: boolean; named: boolean } {
  const players = teams.map((t) => t.players.map((p) => p.trim()).filter(Boolean));
  const named = players.some((p) => p.length > 0);
  const rounds = named ? Math.max(...players.map((p) => p.length)) : 2;
  const seats: Seat[] = [];
  for (let i = 0; i < rounds; i++) {
    teams.forEach((team, t) => {
      if (named) {
        const name = players[t][i];
        if (name) seats.push({ key: `${team.id}-${i}`, label: name, team });
      } else {
        seats.push({ key: `${team.id}-${i}`, label: `${team.name} #${i + 1}`, team });
      }
    });
  }
  const counts = players.map((p) => p.length);
  const uneven = named && Math.min(...counts) !== Math.max(...counts);
  return { seats, uneven, named };
}

const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
const skipLabel = (v: number | null) => (v === null ? 'Unlimited' : String(v));
const secs = (ms: number) => Math.round(ms / 1000);

export default function Setup() {
  const { colors, spacing } = useTheme();
  const draft = useGame((s) => s.draft);
  const actions = useGame(
    useShallow((s) => ({
      setDraft: s.setDraft,
      addTeam: s.addTeam,
      removeTeam: s.removeTeam,
      updateTeam: s.updateTeam,
      shuffleSeats: s.shuffleSeats,
      setPacks: s.setPacks,
      startGame: s.startGame,
    })),
  );
  const afterDarkEnabled = useSettings((s) => s.afterDarkEnabled);
  const packs = useMemo(() => contentService.listPacks({ includeAdult: afterDarkEnabled }), [afterDarkEnabled]);

  // Fresh draft rules from the saved defaults and last pack selection (team names are kept for the
  // session so a group doesn't retype them).
  useEffect(() => {
    const s = useSettings.getState();
    const available = new Set(contentService.listPacks({ includeAdult: s.afterDarkEnabled }).map((p) => p.id));
    const r = s.defaultRules;
    actions.setDraft({
      mode: r.mode,
      targetScore: r.targetScore,
      skipsPerTurn: r.skipsPerTurn,
      fuseMinMs: r.fuseMinMs,
      fuseMaxMs: r.fuseMaxMs,
      showFuse: r.showFuse,
      packIds: s.lastPackIds.filter((id) => available.has(id)),
    });
  }, [actions]);

  const selectedPacks = packs.filter((p) => draft.packIds.includes(p.id));
  const phraseCount = selectedPacks.reduce((n, p) => n + p.phraseCount, 0);
  const canStart = selectedPacks.length > 0;
  const usedColors = draft.teams.map((t) => t.color);
  const { seats, uneven, named } = seatOrder(draft.teams);
  const playerCount = draft.teams.reduce((n, t) => n + t.players.filter((p) => p.trim()).length, 0);

  const start = () => {
    const packIds = selectedPacks.map((p) => p.id);
    if (packIds.length === 0) return;
    actions.setPacks(packIds);
    useSettings.getState().set('lastPackIds', packIds);
    // The root layout follows game.phase to /round.
    actions.startGame();
  };

  return (
    <Screen testID="setup-screen">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <IconButton icon="←" accessibilityLabel="Back" onPress={goBack} testID="setup-back" />
        <AppText variant="title" accessibilityRole="header">
          Custom Game
        </AppText>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: spacing.lg, paddingVertical: spacing.md }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Teams */}
        <View style={{ gap: spacing.sm }}>
          <AppText variant="heading" accessibilityRole="header">
            Teams
          </AppText>
          {draft.teams.map((team, index) => (
            <TeamCard
              key={team.id}
              team={team}
              index={index}
              canRemove={draft.teams.length > LIMITS.minTeams}
              onChange={(patch) => actions.updateTeam(team.id, patch)}
              onRemove={() => actions.removeTeam(team.id)}
              usedColors={usedColors.filter((c) => c !== team.color)}
            />
          ))}
          <Button
            label={
              draft.teams.length >= LIMITS.maxTeams
                ? `${LIMITS.maxTeams} teams is the max`
                : `Add team (${draft.teams.length} of ${LIMITS.maxTeams})`
            }
            icon="➕"
            variant="secondary"
            fullWidth
            disabled={draft.teams.length >= LIMITS.maxTeams}
            onPress={actions.addTeam}
            testID="setup-add-team"
          />
        </View>

        {/* Seating */}
        <Card testID="setup-seating">
          <View style={{ gap: spacing.sm }}>
            <AppText variant="heading" accessibilityRole="header">
              Seating
            </AppText>
            <AppText variant="body" color={colors.textMuted}>
              Sit in a circle so teams alternate. Pass the phone to your left.
            </AppText>
            <View
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}
              accessible
              accessibilityLabel={`Seat order: ${seats.map((s, i) => `${i + 1}, ${s.label}${named ? `, ${s.team.name}` : ''}`).join('; ')}`}
            >
              {seats.map((seat, i) => (
                <View
                  key={seat.key}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.xs,
                    borderWidth: 2,
                    borderColor: seat.team.color,
                    borderRadius: 999,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 2,
                  }}
                >
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: seat.team.color }} />
                  <AppText variant="caption">
                    {i + 1}. {seat.label}
                    {named ? ` (${seat.team.name})` : ''}
                  </AppText>
                </View>
              ))}
              <AppText variant="caption" color={colors.textMuted}>
                ↺ back to 1
              </AppText>
            </View>
            {uneven ? (
              <AppText variant="caption" color={colors.textMuted}>
                Teams are uneven, so a few teammates end up side by side. That&apos;s fine!
              </AppText>
            ) : null}
            {!named ? (
              <AppText variant="caption" color={colors.textMuted}>
                Tip: add player names to a team to get a named seating chart.
              </AppText>
            ) : null}
            <Button
              label="Shuffle seats"
              icon="🔀"
              variant="secondary"
              size="sm"
              disabled={playerCount < 2}
              onPress={actions.shuffleSeats}
              accessibilityHint="Randomly mixes players across teams so teammates alternate seats"
              testID="setup-shuffle"
            />
            {playerCount < 2 ? (
              <AppText variant="caption" color={colors.textMuted}>
                Add at least 2 player names to shuffle.
              </AppText>
            ) : null}
          </View>
        </Card>

        {/* Rules */}
        <View style={{ gap: spacing.md }}>
          <AppText variant="heading" accessibilityRole="header">
            Rules
          </AppText>
          <Stepper
            label="Points to win"
            value={draft.targetScore}
            min={LIMITS.minTargetScore}
            max={LIMITS.maxTargetScore}
            onChange={(targetScore) => actions.setDraft({ targetScore })}
            testID="setup-target"
          />
          <Segmented<number | null>
            label="Skips per turn"
            options={LIMITS.skipChoices.map((v) => ({ value: v, label: skipLabel(v) }))}
            value={draft.skipsPerTurn}
            onChange={(skipsPerTurn) => actions.setDraft({ skipsPerTurn })}
            testID="setup-skips"
          />
          <RangeSlider
            label="Hidden fuse length (seconds)"
            min={secs(LIMITS.fuseFloorMs)}
            max={secs(LIMITS.fuseCeilMs)}
            step={5}
            low={secs(draft.fuseMinMs)}
            high={secs(draft.fuseMaxMs)}
            onChange={(low, high) => actions.setDraft({ fuseMinMs: low * 1000, fuseMaxMs: high * 1000 })}
            format={(v) => `${v}s`}
            testID="setup-fuse"
          />
          <ToggleRow
            label="Chill mode"
            description="Show the fuse on screen. Great for kids."
            value={draft.showFuse}
            onChange={(showFuse) => actions.setDraft({ showFuse })}
            testID="setup-chill"
          />
          {/* Mode picker (Taboo, Charades, One-Word) is P1 and hidden in v1. */}
        </View>

        {/* Packs */}
        <View style={{ gap: spacing.sm }}>
          <AppText variant="heading" accessibilityRole="header">
            Packs
          </AppText>
          <AppText variant="body" color={colors.textMuted} testID="setup-pack-summary">
            {selectedPacks.length === 0
              ? 'No packs selected yet.'
              : `${selectedPacks.length} ${selectedPacks.length === 1 ? 'pack' : 'packs'} · ${phraseCount.toLocaleString()} phrases: ${selectedPacks.map((p) => `${p.emoji} ${p.name}`).join(', ')}`}
          </AppText>
          <Button
            label="Choose packs"
            icon="📦"
            variant="secondary"
            fullWidth
            onPress={() => router.push('/packs')}
            testID="setup-choose-packs"
          />
        </View>
      </ScrollView>

      <View style={{ gap: spacing.xs, paddingTop: spacing.sm }}>
        {!canStart ? (
          <AppText variant="caption" align="center" color={colors.textMuted}>
            Choose at least one pack to start.
          </AppText>
        ) : null}
        <Button
          label="Start"
          icon="🔥"
          size="xl"
          variant="primary"
          fullWidth
          disabled={!canStart}
          onPress={start}
          accessibilityHint={canStart ? 'Starts round 1' : 'Choose at least one pack first'}
          testID="setup-start"
        />
      </View>
    </Screen>
  );
}
