import { Text, View } from 'react-native';

import { Chip } from './Card';
import { ChunkyPressable } from './Chunky';
import { shade } from './color';
import { fonts, fontSizes, radii, spacing } from './tokens';
import { useTheme } from './theme';
import type { PackTileProps } from './types';

/** Display labels for pack tags. */
export const TAG_LABELS: Record<string, string> = {
  family: 'Family',
  adult: '18+',
  kids: 'Kids',
  hard: 'Hard',
  local: 'Local',
  custom: 'Custom',
};

const formatCount = (n: number) => n.toLocaleString('en-US');

/**
 * Pack picker tile: emoji art, name, phrase count and tags. Selected tiles get a filled face,
 * a thick colored border and a check badge (so selection never relies on color alone).
 * Role "checkbox". Fills the width its parent gives it; lay tiles out in a grid.
 */
export function PackTile({ pack, selected, onToggle, testID }: PackTileProps) {
  const { colors } = useTheme();
  const count = `${formatCount(pack.phraseCount)} phrases`;
  const tags = pack.tags.map((t) => TAG_LABELS[t] ?? t);
  return (
    <ChunkyPressable
      testID={testID}
      onPress={onToggle}
      face={selected ? colors.surfaceAlt : colors.surface}
      block={selected ? shade(colors.secondary, 0.35) : colors.shadow}
      border={selected ? colors.secondary : colors.border}
      depth={6}
      radius={radii.lg}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${pack.name}, ${count}${tags.length ? `, ${tags.join(', ')}` : ''}`}
      accessibilityHint={pack.description}
      stretch
      faceStyle={{
        padding: spacing.md,
        minHeight: 156,
        gap: spacing.xs,
        borderWidth: selected ? 5 : 3,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Text accessible={false} allowFontScaling={false} style={{ fontSize: 44, lineHeight: 54 }}>
          {pack.emoji}
        </Text>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            borderWidth: 3,
            borderColor: selected ? colors.secondary : colors.textMuted,
            backgroundColor: selected ? colors.secondary : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected ? (
            <Text
              allowFontScaling={false}
              style={{ fontFamily: fonts.black, fontSize: 18, lineHeight: 22, color: colors.secondaryText }}
            >
              ✓
            </Text>
          ) : null}
        </View>
      </View>
      <Text
        numberOfLines={2}
        maxFontSizeMultiplier={1.4}
        style={{ fontFamily: fonts.black, fontSize: fontSizes.lg, lineHeight: 28, color: colors.text }}
      >
        {pack.name}
      </Text>
      <Text
        maxFontSizeMultiplier={1.5}
        style={{ fontFamily: fonts.bold, fontSize: fontSizes.xs, lineHeight: 18, color: colors.textMuted }}
      >
        {count}
      </Text>
      {tags.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: 'auto' }}>
          {tags.map((t) => (
            <Chip key={t} label={t} />
          ))}
        </View>
      ) : null}
    </ChunkyPressable>
  );
}
