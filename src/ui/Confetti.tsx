import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { makeParticles, particleAt, seededRng, type Particle } from './confettiMath';
import { TEAM_COLORS, motion } from './tokens';
import { useTheme } from './theme';
import type { ConfettiProps } from './types';

const DEFAULT_COLORS = TEAM_COLORS.map((c) => c.hex);
const SECONDS = motion.confetti / 1000;

const Piece = memo(function Piece({
  p,
  progress,
  height,
}: {
  p: Particle;
  progress: SharedValue<number>;
  height: number;
}) {
  const style = useAnimatedStyle(() => {
    const t = progress.get() * SECONDS;
    const pos = particleAt(p, t, height);
    return {
      opacity: progress.get() > 0.8 ? (1 - progress.get()) * 5 : 1,
      transform: [{ translateX: pos.x }, { translateY: pos.y }, { rotate: `${pos.r}deg` }],
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: -p.w / 2,
          top: -p.h / 2,
          width: p.w,
          height: p.h,
          borderRadius: p.round ? p.w / 2 : 2,
          backgroundColor: p.color,
        },
        style,
      ]}
    />
  );
});

/**
 * Full-overlay particle burst (reanimated; no Lottie). Fires each time `active` turns true.
 * Renders nothing when reduce-motion is on (onDone still fires). Never intercepts touches and
 * is hidden from screen readers.
 */
export function Confetti({ active, colors, count = 60, onDone, testID }: ConfettiProps) {
  const { reduceMotion } = useTheme();
  const win = useWindowDimensions();
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const width = box?.width || win.width;
  const height = box?.height || win.height;
  const progress = useSharedValue(0);
  const [burst, setBurst] = useState(0);
  const [running, setRunning] = useState(false);
  const [wasActive, setWasActive] = useState(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  // Each false -> true edge of `active` starts a new burst (state adjusted during render).
  if (active !== wasActive) {
    setWasActive(active);
    if (active && !reduceMotion) {
      setBurst((b) => b + 1);
      setRunning(true);
    }
  }

  useEffect(() => {
    if (!active) return;
    if (reduceMotion) {
      onDoneRef.current?.();
      return;
    }
    const finish = () => {
      setRunning(false);
      onDoneRef.current?.();
    };
    progress.set(0);
    progress.set(
      withTiming(1, { duration: motion.confetti, easing: Easing.linear }, (finished) => {
        if (finished) scheduleOnRN(finish);
      }),
    );
    return () => cancelAnimation(progress);
  }, [active, reduceMotion, progress]);

  const paletteKey = (colors && colors.length ? colors : DEFAULT_COLORS).join(',');
  // Seeded per burst: a fresh spray each time, stable across re-renders/resizes within one.
  const particles = useMemo(
    () => makeParticles(count, width, height, paletteKey.split(','), seededRng(burst * 7919 + 1)),
    [burst, count, width, height, paletteKey],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (w > 0 && h > 0 && (w !== box?.width || h !== box?.height)) setBox({ width: w, height: h });
  };

  if (reduceMotion || (!active && !running)) return null;

  return (
    <View
      testID={testID}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      onLayout={onLayout}
      style={[StyleSheet.absoluteFill, { overflow: 'hidden', zIndex: 10 }]}
    >
      {particles.map((p, i) => (
        <Piece key={`${burst}-${i}`} p={p} progress={progress} height={height} />
      ))}
    </View>
  );
}
