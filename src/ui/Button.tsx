import { Text, View } from 'react-native';

import { ChunkyPressable } from './Chunky';
import { readableTextOn, shade } from './color';
import { buttonSizes, findTeamColor, fonts, minTouch, radii, spacing } from './tokens';
import { useTheme } from './theme';
import type { Palette } from './tokens';
import type { ButtonProps, ButtonVariant, IconButtonProps } from './types';

/** Face, label and block colors for a button. Exported for tests and custom controls. */
export function buttonColors(
  colors: Palette,
  variant: ButtonVariant,
  override?: string,
): { face: string; label: string; block: string } {
  if (override) {
    const label = findTeamColor(override)?.text ?? readableTextOn(override);
    return { face: override, label, block: shade(override, 0.35) };
  }
  switch (variant) {
    case 'secondary':
      return { face: colors.secondary, label: colors.secondaryText, block: shade(colors.secondary, 0.4) };
    case 'danger':
      return { face: colors.danger, label: colors.dangerText, block: shade(colors.danger, 0.4) };
    case 'ghost':
      return { face: 'transparent', label: colors.text, block: 'transparent' };
    case 'primary':
    default:
      return { face: colors.primary, label: colors.primaryText, block: shade(colors.primary, 0.4) };
  }
}

/** Big chunky toy button. Min 48 px tall; the face presses down into its shadow block. */
export function Button({
  label,
  onPress,
  onLongPress,
  variant = 'primary',
  size = 'md',
  icon,
  color,
  disabled,
  fullWidth,
  accessibilityLabel,
  accessibilityHint,
  style,
  debounceMs,
  testID,
}: ButtonProps) {
  const { colors } = useTheme();
  const s = buttonSizes[size];
  const c = buttonColors(colors, variant, color);
  const ghost = variant === 'ghost' && !color;
  return (
    <ChunkyPressable
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      debounceMs={debounceMs}
      face={c.face}
      block={c.block}
      border={ghost ? colors.textMuted : colors.border}
      depth={ghost ? 0 : size === 'sm' ? 4 : size === 'xl' ? 8 : 6}
      radius={size === 'xl' ? radii.lg : radii.md}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      style={[fullWidth ? { alignSelf: 'stretch' } : null, style]}
      faceStyle={{
        minHeight: s.minHeight,
        paddingVertical: s.paddingV,
        paddingHorizontal: s.paddingH,
        justifyContent: 'center',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
        {icon ? (
          <Text
            accessible={false}
            importantForAccessibility="no"
            maxFontSizeMultiplier={1.4}
            style={{ fontSize: s.fontSize * 1.1, lineHeight: s.fontSize * 1.4 }}
          >
            {icon}
          </Text>
        ) : null}
        <Text
          maxFontSizeMultiplier={size === 'xl' ? 1.3 : 1.6}
          style={{
            flexShrink: 1,
            fontFamily: fonts.black,
            fontSize: s.fontSize,
            lineHeight: Math.round(s.fontSize * 1.3),
            color: c.label,
            textAlign: 'center',
          }}
        >
          {label}
        </Text>
      </View>
    </ChunkyPressable>
  );
}

const ICON_SIZES = { sm: minTouch, md: 56, lg: 72 } as const;

/** Round chunky icon-only button. `accessibilityLabel` is required. */
export function IconButton({
  icon,
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
  size = 'md',
  delayLongPress,
  color,
  disabled,
  testID,
}: IconButtonProps) {
  const { colors } = useTheme();
  const d = ICON_SIZES[size];
  const face = color ?? colors.surface;
  return (
    <ChunkyPressable
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      disabled={disabled}
      face={face}
      block={color ? shade(color, 0.35) : colors.shadow}
      border={colors.border}
      depth={size === 'lg' ? 6 : 4}
      radius={radii.pill}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={{ alignSelf: 'flex-start' }}
      faceStyle={{ width: d, height: d, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text
        accessible={false}
        importantForAccessibility="no"
        allowFontScaling={false}
        style={{
          fontSize: d * 0.45,
          lineHeight: d * 0.6,
          fontFamily: fonts.black,
          color: color ? readableTextOn(color) : colors.text,
        }}
      >
        {icon}
      </Text>
    </ChunkyPressable>
  );
}
