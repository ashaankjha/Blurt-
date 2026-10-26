import { Text } from 'react-native';

import { textVariants } from './tokens';
import { useTheme } from './theme';
import type { AppTextProps } from './types';

/**
 * Themed text. Scales with the OS font size (Dynamic Type / Android font scale) up to a
 * per-variant cap so headings stay on screen at the largest accessibility sizes.
 * `display`, `title` and `heading` default to accessibilityRole "header".
 */
export function AppText({
  children,
  variant = 'body',
  color,
  align,
  numberOfLines,
  style,
  accessibilityRole,
  maxFontSizeMultiplier,
  decorative,
  testID,
}: AppTextProps) {
  const { colors } = useTheme();
  const v = textVariants[variant];
  const isHeader = variant === 'display' || variant === 'title' || variant === 'heading';
  return (
    <Text
      testID={testID}
      accessibilityRole={accessibilityRole ?? (isHeader ? 'header' : undefined)}
      accessible={decorative ? false : undefined}
      importantForAccessibility={decorative ? 'no-hide-descendants' : undefined}
      accessibilityElementsHidden={decorative || undefined}
      aria-hidden={decorative || undefined}
      numberOfLines={numberOfLines}
      allowFontScaling
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? v.maxScale}
      style={[
        {
          fontFamily: v.font,
          fontSize: v.size,
          lineHeight: v.lineHeight,
          color: color ?? (variant === 'caption' ? colors.textMuted : colors.text),
          textAlign: align,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
