import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from './AppText';
import { readableTextOn, shade } from './color';
import { chunkyShadow, findTeamColor, fonts, fontSizes, radii, spacing } from './tokens';
import { useTheme } from './theme';
import type { ScoreRowProps } from './types';

/** Above this target, pips become a continuous bar. */
const MAX_PIPS = 12;

/**
 * One team's line on the scoreboard: color badge, name, score, progress pips toward the target
 * and an optional animated "+1" badge. Read as one element by screen readers.
 */
export function ScoreRow({ team, score, target, highlight, delta, testID }: ScoreRowProps) {
  const { colors, reduceMotion } = useTheme();
  const onTeam = findTeamColor(team.color)?.text ?? readableTextOn(team.color);
  const filled = Math.max(0, Math.min(score, target));

  const badge = useSharedValue(delta ? 1 : 0);
  useEffect(() => {
    if (!delta) {
      badge.set(0);
      return;
    }
    if (reduceMotion) {
      badge.set(1);
      return;
    }
    badge.set(0);
    badge.set(withSequence(withSpring(1.25, { damping: 6, stiffness: 300 }), withTiming(1, { duration: 120 })));
  }, [delta, reduceMotion, badge]);
  const badgeStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, badge.get()),
    transform: [{ scale: badge.get() }, { translateY: (1 - Math.min(1, badge.get())) * 10 }],
  }));

  const deltaText = delta ? `${delta > 0 ? '+' : '−'}${Math.abs(delta)}` : '';
  const a11y = `${team.name}: ${score} of ${target} points${delta ? `, ${delta > 0 ? 'plus' : 'minus'} ${Math.abs(delta)}` : ''}${highlight ? ', leading' : ''}`;

  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={a11y}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radii.lg,
        borderWidth: highlight ? chunkyShadow.borderWidth + 2 : chunkyShadow.borderWidth,
        borderColor: highlight ? team.color : colors.border,
        backgroundColor: highlight ? colors.surfaceAlt : colors.surface,
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: team.color,
          borderWidth: chunkyShadow.borderWidth,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text allowFontScaling={false} style={{ fontFamily: fonts.black, fontSize: 22, lineHeight: 28, color: onTeam }}>
          {team.name.trim().charAt(0).toUpperCase() || '?'}
        </Text>
      </View>

      <View style={{ flex: 1, gap: spacing.xs }}>
        <AppText variant="heading" numberOfLines={2} accessibilityRole="text">
          {highlight ? `👑 ${team.name}` : team.name}
        </AppText>
        {target <= MAX_PIPS ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            {Array.from({ length: target }, (_, i) => (
              <View
                key={i}
                testID={testID ? `${testID}-pip-${i < filled ? 'on' : 'off'}` : undefined}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  borderWidth: 2,
                  borderColor: colors.border,
                  backgroundColor: i < filled ? team.color : colors.track,
                }}
              />
            ))}
          </View>
        ) : (
          <View
            style={{
              height: 14,
              borderRadius: radii.pill,
              borderWidth: 2,
              borderColor: colors.border,
              backgroundColor: colors.track,
              overflow: 'hidden',
            }}
          >
            <View
              style={{ width: `${(filled / Math.max(1, target)) * 100}%`, height: '100%', backgroundColor: team.color }}
            />
          </View>
        )}
      </View>

      <View style={{ alignItems: 'flex-end', minWidth: 56 }}>
        <Text
          maxFontSizeMultiplier={1.3}
          style={{ fontFamily: fonts.black, fontSize: fontSizes.xxl, lineHeight: 44, color: colors.text }}
        >
          {score}
        </Text>
        <Text
          maxFontSizeMultiplier={1.5}
          style={{ fontFamily: fonts.bold, fontSize: fontSizes.xs, lineHeight: 16, color: colors.textMuted }}
        >
          of {target}
        </Text>
      </View>

      {delta ? (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: -12,
              right: -8,
              paddingHorizontal: spacing.sm,
              paddingVertical: 2,
              borderRadius: radii.pill,
              backgroundColor: delta > 0 ? colors.success : colors.danger,
              borderWidth: chunkyShadow.borderWidth,
              borderColor: shade(delta > 0 ? colors.success : colors.danger, 0.5),
            },
            badgeStyle,
          ]}
        >
          <Text
            allowFontScaling={false}
            style={{
              fontFamily: fonts.black,
              fontSize: fontSizes.lg,
              lineHeight: 28,
              color: delta > 0 ? colors.successText : colors.dangerText,
            }}
          >
            {deltaText}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}
