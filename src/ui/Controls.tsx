import { useEffect } from 'react';
import { Pressable, Text, View, type AccessibilityActionEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { AppText } from './AppText';
import { ariaProps } from './a11y';
import { ChunkyPressable } from './Chunky';
import { shade } from './color';
import { stepValue } from './rangeMath';
import { chunkyShadow, fonts, fontSizes, minTouch, motion, radii, spacing } from './tokens';
import { useTheme } from './theme';
import type { SegmentedProps, StepperProps, ToggleRowProps } from './types';

function StepButton({
  glyph,
  label,
  disabled,
  onPress,
  testID,
}: {
  glyph: string;
  label: string;
  disabled: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <ChunkyPressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      face={colors.secondary}
      block={shade(colors.secondary, 0.4)}
      border={colors.border}
      depth={4}
      radius={radii.pill}
      accessibilityLabel={label}
      faceStyle={{ width: minTouch, height: minTouch, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text
        allowFontScaling={false}
        style={{ fontFamily: fonts.black, fontSize: 28, lineHeight: 34, color: colors.secondaryText }}
      >
        {glyph}
      </Text>
    </ChunkyPressable>
  );
}

/**
 * Label + [−] value [+]. Clamps to [min, max]; the buttons disable at the ends.
 *
 * Accessibility: the label is one "adjustable" element (`testID`) that announces the value and
 * takes increment/decrement actions (VoiceOver/TalkBack swipe up/down). The −/+ buttons
 * (`${testID}-dec` / `-inc`) and the value (`${testID}-value`) stay separate accessible elements,
 * like a native UIStepper, so Voice Control, Switch Control and UI automation (XCUITest/Maestro,
 * which hides the children of an accessible element) can reach them.
 */
export function Stepper({ label, value, min, max, step = 1, onChange, format, testID }: StepperProps) {
  const { colors } = useTheme();
  const text = format ? format(value) : String(value);
  const dec = stepValue(value, -step, min, max, step);
  const inc = stepValue(value, step, min, max, step);
  const onAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment' && inc !== value) onChange(inc);
    if (e.nativeEvent.actionName === 'decrement' && dec !== value) onChange(dec);
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
      <View
        testID={testID}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value, text }}
        {...ariaProps(null, { min, max, now: value, text })}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAction}
        style={{ flex: 1, minWidth: 120, minHeight: minTouch, justifyContent: 'center' }}
      >
        <AppText variant="label">{label}</AppText>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <StepButton
          glyph="−"
          label={`Decrease ${label}`}
          disabled={value <= min}
          onPress={() => onChange(dec)}
          testID={testID ? `${testID}-dec` : undefined}
        />
        <Text
          testID={testID ? `${testID}-value` : undefined}
          maxFontSizeMultiplier={1.4}
          style={{
            minWidth: 64,
            textAlign: 'center',
            fontFamily: fonts.black,
            fontSize: fontSizes.xl,
            lineHeight: 36,
            color: colors.text,
          }}
        >
          {text}
        </Text>
        <StepButton
          glyph="+"
          label={`Increase ${label}`}
          disabled={value >= max}
          onPress={() => onChange(inc)}
          testID={testID ? `${testID}-inc` : undefined}
        />
      </View>
    </View>
  );
}

/** Single-choice pill group (radio semantics). Works with any value type, including null. */
export function Segmented<T>({ label, options, value, onChange, disabled, testID }: SegmentedProps<T>) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={{ gap: spacing.xs }}>
      {label ? <AppText variant="label">{label}</AppText> : null}
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled }}
        aria-disabled={!!disabled}
        style={{
          opacity: disabled ? 0.45 : 1,
          flexDirection: 'row',
          flexWrap: 'wrap',
          padding: spacing.xs,
          gap: spacing.xs,
          borderRadius: radii.lg,
          borderWidth: chunkyShadow.borderWidth,
          borderColor: colors.border,
          backgroundColor: colors.surfaceAlt,
        }}
      >
        {options.map((o, i) => {
          const selected = Object.is(o.value, value);
          return (
            <ChunkyPressable
              key={`${i}:${o.label}`}
              testID={testID ? `${testID}-${i}` : undefined}
              onPress={() => {
                if (!selected) onChange(o.value);
              }}
              disabled={disabled}
              dimDisabled={false}
              face={selected ? colors.secondary : 'transparent'}
              block={selected ? shade(colors.secondary, 0.4) : 'transparent'}
              border={selected ? colors.border : null}
              depth={selected ? 3 : 0}
              radius={radii.md}
              accessibilityRole="radio"
              accessibilityLabel={o.label}
              accessibilityState={{ checked: selected, selected }}
              style={{ flexGrow: 1 }}
              faceStyle={{
                minHeight: 44,
                paddingHorizontal: spacing.md,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                maxFontSizeMultiplier={1.5}
                style={{
                  fontFamily: selected ? fonts.black : fonts.bold,
                  fontSize: fontSizes.md,
                  lineHeight: 24,
                  color: selected ? colors.secondaryText : colors.text,
                }}
              >
                {o.label}
              </Text>
            </ChunkyPressable>
          );
        })}
      </View>
    </View>
  );
}

const TRACK_W = 64;
const TRACK_H = 38;
const KNOB = 28;

/** Whole-row tappable on/off switch with a chunky toy toggle. Role "switch". */
export function ToggleRow({ label, description, value, onChange, disabled, testID }: ToggleRowProps) {
  const { colors, reduceMotion } = useTheme();
  const on = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    on.set(reduceMotion ? (value ? 1 : 0) : withTiming(value ? 1 : 0, { duration: motion.quick }));
  }, [value, reduceMotion, on]);
  const knob = useAnimatedStyle(() => ({
    transform: [{ translateX: on.get() * (TRACK_W - KNOB - 10) }],
  }));
  return (
    <Pressable
      testID={testID}
      onPress={() => onChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      {...ariaProps({ checked: value, disabled: !!disabled })}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        minHeight: minTouch,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <View style={{ flex: 1 }}>
        <AppText variant="label">{label}</AppText>
        {description ? <AppText variant="caption">{description}</AppText> : null}
      </View>
      <View
        style={{
          width: TRACK_W,
          height: TRACK_H,
          borderRadius: radii.pill,
          borderWidth: chunkyShadow.borderWidth,
          borderColor: colors.border,
          backgroundColor: value ? colors.success : colors.track,
          justifyContent: 'center',
          paddingHorizontal: 2,
        }}
      >
        <Animated.View
          style={[
            {
              width: KNOB,
              height: KNOB,
              borderRadius: KNOB / 2,
              backgroundColor: colors.surface,
              borderWidth: 2,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            },
            knob,
          ]}
        >
          <Text
            allowFontScaling={false}
            style={{ fontFamily: fonts.black, fontSize: 14, lineHeight: 18, color: colors.text }}
          >
            {value ? '✓' : ''}
          </Text>
        </Animated.View>
      </View>
    </Pressable>
  );
}
