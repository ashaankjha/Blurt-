import { Pressable, Text, TextInput, View } from 'react-native';

import { AppText } from './AppText';
import { ariaProps } from './a11y';
import { Button, IconButton } from './Button';
import { Card } from './Card';
import { readableTextOn } from './color';
import { TEAM_COLORS, chunkyShadow, findTeamColor, fonts, fontSizes, minTouch, radii, spacing } from './tokens';
import { TextField } from './TextField';
import { useTheme } from './theme';
import type { TeamCardProps } from './types';

const MAX_PLAYERS = 12;
const sameHex = (a: string, b: string) => a.toUpperCase() === b.toUpperCase();

/**
 * Setup screen team editor: name, color picker (colors taken by other teams are disabled),
 * optional player names (add / edit / remove) and a remove-team button.
 * Every change goes through `onChange(patch)`; the card holds no state of its own.
 */
export function TeamCard({
  team,
  index,
  canRemove,
  onChange,
  onRemove,
  usedColors,
  showPlayers = true,
  maxNameLength = 20,
  testID,
}: TeamCardProps) {
  const { colors } = useTheme();
  const colorName = findTeamColor(team.color)?.name ?? 'Custom';
  const badgeText = findTeamColor(team.color)?.text ?? readableTextOn(team.color);
  const id = testID ?? `team-${index}`;
  const label = team.name.trim() || `Team ${index + 1}`;

  const setPlayer = (i: number, name: string) => {
    const players = team.players.slice();
    players[i] = name;
    onChange({ players });
  };
  const removePlayer = (i: number) => onChange({ players: team.players.filter((_, j) => j !== i) });
  const addPlayer = () => onChange({ players: [...team.players, ''] });

  return (
    <Card color={team.color} testID={id}>
      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View
            accessible
            accessibilityLabel={`Team ${index + 1}, ${colorName}`}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: team.color,
              borderWidth: chunkyShadow.borderWidth,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              allowFontScaling={false}
              style={{ fontFamily: fonts.black, fontSize: 20, lineHeight: 26, color: badgeText }}
            >
              {index + 1}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="heading" numberOfLines={1}>
              {label}
            </AppText>
          </View>
          {canRemove ? (
            <IconButton
              icon="✕"
              size="sm"
              onPress={onRemove}
              accessibilityLabel={`Remove ${label}`}
              testID={`${id}-remove`}
            />
          ) : null}
        </View>

        <TextField
          label={`Team ${index + 1} name`}
          value={team.name}
          onChangeText={(name) => onChange({ name })}
          maxLength={maxNameLength}
          placeholder={`Team ${index + 1}`}
          testID={`${id}-name`}
        />

        <View style={{ gap: spacing.xs }}>
          <AppText variant="label">Color</AppText>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={`${label} color`}
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}
          >
            {TEAM_COLORS.map((c) => {
              const selected = sameHex(c.hex, team.color);
              const taken = !selected && usedColors.some((u) => sameHex(u, c.hex));
              return (
                <Pressable
                  key={c.hex}
                  testID={`${id}-color-${c.name.toLowerCase()}`}
                  onPress={() => {
                    if (!selected) onChange({ color: c.hex });
                  }}
                  disabled={taken}
                  accessibilityRole="radio"
                  accessibilityLabel={taken ? `${c.name}, taken by another team` : c.name}
                  accessibilityState={{ checked: selected, selected, disabled: taken }}
                  {...ariaProps({ checked: selected, selected, disabled: taken })}
                  style={{
                    width: minTouch,
                    height: minTouch,
                    borderRadius: minTouch / 2,
                    backgroundColor: c.hex,
                    borderWidth: selected ? 5 : chunkyShadow.borderWidth,
                    borderColor: selected ? colors.text : colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: taken ? 0.35 : 1,
                  }}
                >
                  <Text
                    allowFontScaling={false}
                    style={{ fontFamily: fonts.black, fontSize: 20, lineHeight: 24, color: c.text }}
                  >
                    {selected ? '✓' : taken ? '✕' : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {showPlayers ? (
          <View style={{ gap: spacing.sm }}>
            <AppText variant="label">Players (optional)</AppText>
            {team.players.map((p, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <TextInput
                  testID={`${id}-player-${i}`}
                  accessibilityLabel={`${label} player ${i + 1} name`}
                  value={p}
                  onChangeText={(name) => setPlayer(i, name)}
                  placeholder={`Player ${i + 1}`}
                  placeholderTextColor={colors.textMuted}
                  maxLength={maxNameLength}
                  returnKeyType="next"
                  maxFontSizeMultiplier={1.8}
                  selectionColor={colors.secondary}
                  style={{
                    flex: 1,
                    minHeight: minTouch,
                    paddingHorizontal: spacing.md,
                    borderWidth: 2,
                    borderColor: colors.border,
                    borderRadius: radii.md,
                    backgroundColor: colors.inputBackground,
                    color: colors.text,
                    fontFamily: fonts.regular,
                    fontSize: fontSizes.md,
                  }}
                />
                <IconButton
                  icon="−"
                  size="sm"
                  onPress={() => removePlayer(i)}
                  accessibilityLabel={`Remove player ${i + 1}${p.trim() ? `, ${p.trim()}` : ''}`}
                  testID={`${id}-player-${i}-remove`}
                />
              </View>
            ))}
            {team.players.length < MAX_PLAYERS ? (
              <Button
                label="Add player"
                icon="➕"
                variant="ghost"
                size="sm"
                onPress={addPlayer}
                accessibilityLabel={`Add player to ${label}`}
                testID={`${id}-add-player`}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </Card>
  );
}
