import { useEffect, useMemo, useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { fitPhrase } from './phraseFit';
import { fontSizes, fonts, radii, spacing } from './tokens';
import { useTheme } from './theme';
import type { PhraseTextProps } from './types';

/**
 * The Round screen's phrase: huge, centered, auto-sized to fill its box (min 40, max 96),
 * wrapping on word boundaries. Give it a flex container; it fills it.
 *
 * Size is computed synchronously from the measured box (see phraseFit.ts), so a new phrase
 * renders straight at its final size. The text is invisible only until the very first layout.
 * When `hidden`, the phrase is not rendered at all (nothing for a screen reader to leak).
 */
export function PhraseText({ text, color, hidden, hiddenLabel = 'Paused', maxFontSize, testID }: PhraseTextProps) {
  const { colors, reduceMotion } = useTheme();
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((prev) =>
      prev && Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1 ? prev : { width, height },
    );
  };

  const fit = useMemo(
    () =>
      fitPhrase(text, {
        width: box?.width ?? 320,
        height: box?.height,
        max: maxFontSize ?? fontSizes.phraseMax,
      }),
    [text, box, maxFontSize],
  );

  const pop = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion || hidden) return;
    pop.set(0.9);
    pop.set(withSpring(1, { damping: 12, stiffness: 260, mass: 0.6 }));
  }, [text, hidden, reduceMotion, pop]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));

  return (
    <View
      testID={testID}
      onLayout={onLayout}
      style={{ flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}
    >
      {hidden ? (
        <View
          testID={testID ? `${testID}-hidden` : undefined}
          accessible
          accessibilityLabel={`Phrase hidden. ${hiddenLabel}`}
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: spacing.xl,
            paddingHorizontal: spacing.xxl,
            borderRadius: radii.lg,
            backgroundColor: colors.placeholder,
            gap: spacing.sm,
          }}
        >
          <Text style={{ fontSize: 56, lineHeight: 68 }} allowFontScaling={false}>
            ⏸️
          </Text>
          <Text
            allowFontScaling={false}
            style={{ fontFamily: fonts.black, fontSize: fontSizes.phraseMin, lineHeight: 52, color: colors.textMuted }}
          >
            {hiddenLabel}
          </Text>
        </View>
      ) : (
        <Animated.View style={[{ opacity: box ? 1 : 0, alignSelf: 'stretch' }, popStyle]}>
          <Text
            allowFontScaling={false}
            accessibilityRole="text"
            style={{
              fontFamily: fonts.black,
              fontSize: fit.fontSize,
              lineHeight: fit.lineHeight,
              color: color ?? colors.text,
              textAlign: 'center',
            }}
          >
            {text}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}
