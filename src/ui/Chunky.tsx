import type { ReactNode } from 'react';
import { useCallback, useRef } from 'react';
import {
  Pressable,
  View,
  type AccessibilityRole,
  type AccessibilityState,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ariaProps } from './a11y';
import { chunkyShadow, motion } from './tokens';
import { useTheme } from './theme';

export interface ChunkyPressableProps {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  delayLongPress?: number;
  disabled?: boolean;
  /** Face fill. */
  face: string;
  /** Solid block under the face. */
  block: string;
  /** Border around face and block; null for none. */
  border?: string | null;
  radius: number;
  /** How far the face sits above the block (and travels when pressed). 0 = flat. */
  depth?: number;
  faceStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  debounceMs?: number;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: AccessibilityState;
  accessibilityValue?: { min?: number; max?: number; now?: number; text?: string };
  hitSlop?: number;
  /** Dim when disabled (default true). Groups that dim themselves pass false. */
  dimDisabled?: boolean;
  /** Grow to fill the parent's cross-axis/extra space (equal-height grid tiles). */
  stretch?: boolean;
  testID?: string;
}

/**
 * The toy-button primitive: a face sitting on a darker solid block. Pressing pushes the face
 * down into the block (instant when reduce-motion is on). Used by Button, IconButton, Chip,
 * PackTile and the Stepper buttons.
 */
export function ChunkyPressable({
  children,
  onPress,
  onLongPress,
  delayLongPress,
  disabled,
  face,
  block,
  border,
  radius,
  depth = chunkyShadow.offsetY,
  faceStyle,
  style,
  debounceMs,
  accessibilityRole = 'button',
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  accessibilityValue,
  hitSlop,
  stretch,
  dimDisabled = true,
  testID,
}: ChunkyPressableProps) {
  const { reduceMotion } = useTheme();
  const pressed = useSharedValue(0);
  const lastPress = useRef(-Infinity);

  const setPressed = useCallback(
    (to: 0 | 1) => {
      pressed.set(reduceMotion ? to : withTiming(to, { duration: motion.press }));
    },
    [pressed, reduceMotion],
  );

  const handlePress = useCallback(() => {
    if (!onPress) return;
    if (debounceMs) {
      const now = Date.now();
      if (now - lastPress.current < debounceMs) return;
      lastPress.current = now;
    }
    onPress();
  }, [onPress, debounceMs]);

  const faceAnim = useAnimatedStyle(() => ({
    transform: [{ translateY: pressed.get() * depth }],
  }));

  const borderWidth = border ? chunkyShadow.borderWidth : 0;

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      onPressIn={() => setPressed(1)}
      onPressOut={() => setPressed(0)}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ ...accessibilityState, disabled: !!disabled }}
      accessibilityValue={accessibilityValue}
      {...ariaProps({ ...accessibilityState, disabled: !!disabled }, accessibilityValue)}
      style={[{ opacity: disabled && dimDisabled ? 0.45 : 1 }, stretch ? { flexGrow: 1 } : null, style]}
    >
      <View style={{ paddingBottom: depth, flexGrow: stretch ? 1 : undefined }}>
        {depth > 0 ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              top: depth,
              backgroundColor: block,
              borderRadius: radius,
              borderWidth,
              borderColor: border ?? undefined,
            }}
          />
        ) : null}
        <Animated.View
          style={[
            {
              flexGrow: stretch ? 1 : undefined,
              backgroundColor: face,
              borderRadius: radius,
              borderWidth,
              borderColor: border ?? undefined,
            },
            faceStyle,
            faceAnim,
          ]}
        >
          {children}
        </Animated.View>
      </View>
    </Pressable>
  );
}
