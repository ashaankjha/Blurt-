import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ariaProps } from './a11y';
import { chunkyShadow, fuseColors, radii } from './tokens';
import { useTheme } from './theme';
import type { FuseBarProps } from './types';

const HEIGHT = 20;
const SPARK = 30;

/** Fuse color for a remaining fraction (1 = full fuse, 0 = blown). */
export function fuseColorFor(remaining: number): string {
  if (remaining > 0.5) return fuseColors.plenty;
  if (remaining > 0.2) return fuseColors.short;
  return fuseColors.critical;
}

/**
 * Chill-mode visible fuse: a bomb on the left and a burning fuse that shortens toward it.
 * Only for chill mode; the default game never shows the remaining time.
 * The spark flickers unless reduce-motion is on.
 */
export function FuseBar({ progress, testID }: FuseBarProps) {
  const { colors, reduceMotion } = useTheme();
  const p = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const remaining = 1 - p;
  const pct = Math.round(remaining * 100);
  const blown = remaining <= 0;

  const flicker = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion || blown) {
      cancelAnimation(flicker);
      flicker.set(1);
      return;
    }
    flicker.set(
      withRepeat(withSequence(withTiming(1.25, { duration: 120 }), withTiming(0.9, { duration: 140 })), -1, true),
    );
    return () => cancelAnimation(flicker);
  }, [reduceMotion, blown, flicker]);
  const sparkStyle = useAnimatedStyle(() => ({ transform: [{ scale: flicker.get() }] }));

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Fuse"
      accessibilityValue={{ min: 0, max: 100, now: pct, text: `${pct}% of the fuse left` }}
      {...ariaProps(null, { min: 0, max: 100, now: pct, text: `${pct}% of the fuse left` })}
      style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44 }}
    >
      <Text allowFontScaling={false} style={{ fontSize: 32, lineHeight: 40, marginRight: -4, zIndex: 1 }}>
        💣
      </Text>
      <View style={{ flex: 1, height: HEIGHT, justifyContent: 'center' }}>
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: HEIGHT,
            borderRadius: radii.pill,
            backgroundColor: colors.track,
            borderWidth: chunkyShadow.borderWidth - 1,
            borderColor: colors.border,
          }}
        />
        <View
          testID={testID ? `${testID}-fill` : undefined}
          style={{
            width: `${remaining * 100}%`,
            height: HEIGHT,
            borderRadius: radii.pill,
            backgroundColor: fuseColorFor(remaining),
            borderWidth: chunkyShadow.borderWidth - 1,
            borderColor: colors.border,
          }}
        />
        {remaining > 0 ? (
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: `${remaining * 100}%`,
                marginLeft: -SPARK / 2,
                width: SPARK,
                height: SPARK,
                alignItems: 'center',
                justifyContent: 'center',
              },
              sparkStyle,
            ]}
          >
            <Text allowFontScaling={false} style={{ fontSize: 22, lineHeight: 28 }}>
              🔥
            </Text>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}
