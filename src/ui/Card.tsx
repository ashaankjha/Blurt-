import { Text, View } from 'react-native';

import { ChunkyPressable } from './Chunky';
import { readableTextOn, shade } from './color';
import { chunkyShadow, fonts, fontSizes, radii, spacing } from './tokens';
import { useTheme } from './theme';
import type { CardProps, ChipProps } from './types';

const CARD_DEPTH = 5;

/** Surface panel with a thick border and a solid offset block underneath. */
export function Card({ children, color, style, testID }: CardProps) {
  const { colors } = useTheme();
  const border = color ?? colors.border;
  return (
    <View testID={testID} style={[{ paddingBottom: CARD_DEPTH }, style]}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          top: CARD_DEPTH,
          borderRadius: radii.lg,
          backgroundColor: color ? shade(color, 0.3) : colors.shadow,
        }}
      />
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: radii.lg,
          borderWidth: chunkyShadow.borderWidth,
          borderColor: border,
          padding: spacing.md,
        }}
      >
        {children}
      </View>
    </View>
  );
}

/**
 * Small pill. Interactive (toggle-style, with `selected` state) when `onPress` is given;
 * otherwise a static tag.
 */
export function Chip({ label, selected, onPress, icon, color, disabled, accessibilityLabel, testID }: ChipProps) {
  const { colors } = useTheme();
  const fill = color ?? colors.secondary;
  const labelColor = selected ? (color ? readableTextOn(color) : colors.secondaryText) : colors.text;
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      {icon ? (
        <Text accessible={false} importantForAccessibility="no" style={{ fontSize: fontSizes.sm }}>
          {icon}
        </Text>
      ) : null}
      <Text
        maxFontSizeMultiplier={1.6}
        style={{
          fontFamily: fonts.bold,
          fontSize: onPress ? fontSizes.sm : fontSizes.xs,
          lineHeight: onPress ? 22 : 18,
          color: labelColor,
        }}
      >
        {selected && onPress ? `✓ ${label}` : label}
      </Text>
    </View>
  );

  if (!onPress) {
    return (
      <View
        testID={testID}
        accessible
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={disabled ? { disabled: true } : undefined}
        aria-disabled={disabled ? true : undefined}
        style={{
          opacity: disabled ? 0.45 : 1,
          alignSelf: 'flex-start',
          paddingHorizontal: spacing.sm,
          paddingVertical: 2,
          borderRadius: radii.pill,
          borderWidth: 2,
          borderColor: selected ? fill : colors.textMuted,
          backgroundColor: selected ? fill : 'transparent',
        }}
      >
        {content}
      </View>
    );
  }

  return (
    <ChunkyPressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      face={selected ? fill : colors.surface}
      block={selected ? shade(fill, 0.4) : colors.shadow}
      border={colors.border}
      depth={3}
      radius={radii.pill}
      hitSlop={4}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: !!selected }}
      style={{ alignSelf: 'flex-start' }}
      faceStyle={{ minHeight: 40, paddingHorizontal: spacing.md, justifyContent: 'center' }}
    >
      {content}
    </ChunkyPressable>
  );
}
