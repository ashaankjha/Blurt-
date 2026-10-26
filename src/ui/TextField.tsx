import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { AppText } from './AppText';
import { chunkyShadow, fontSizes, fonts, minTouch, radii, spacing } from './tokens';
import { useTheme } from './theme';
import type { SearchFieldProps, TextFieldProps } from './types';

/** Labeled text input. The label is the input's accessible name. */
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  maxLength,
  autoFocus,
  onSubmitEditing,
  multiline,
  error,
  accessibilityHint,
  testID,
}: TextFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label" accessibilityRole="text" decorative>
        {label}
      </AppText>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        accessibilityHint={error ? `${error}. ${accessibilityHint ?? ''}`.trim() : accessibilityHint}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        maxLength={maxLength}
        autoFocus={autoFocus}
        onSubmitEditing={onSubmitEditing}
        multiline={multiline}
        returnKeyType={multiline ? 'default' : 'done'}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        maxFontSizeMultiplier={1.8}
        selectionColor={colors.secondary}
        style={{
          minHeight: multiline ? minTouch * 3 : minTouch + 4,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderWidth: chunkyShadow.borderWidth,
          borderColor: error ? colors.danger : focused ? colors.secondary : colors.border,
          borderRadius: radii.md,
          backgroundColor: colors.inputBackground,
          color: colors.text,
          fontFamily: fonts.regular,
          fontSize: fontSizes.md,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
      {error ? (
        <AppText variant="caption" color={colors.danger} accessibilityRole="text">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

/** Pill-shaped search input with a clear button. */
export function SearchField({ value, onChangeText, placeholder, accessibilityLabel, testID }: SearchFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: minTouch + 4,
        paddingLeft: spacing.md,
        borderWidth: chunkyShadow.borderWidth,
        borderColor: focused ? colors.secondary : colors.border,
        borderRadius: radii.pill,
        backgroundColor: colors.inputBackground,
      }}
    >
      <Text accessible={false} importantForAccessibility="no" style={{ fontSize: 18, marginRight: spacing.sm }}>
        🔍
      </Text>
      <TextInput
        testID={testID}
        accessibilityRole="search"
        accessibilityLabel={accessibilityLabel ?? placeholder ?? 'Search'}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? 'Search'}
        placeholderTextColor={colors.textMuted}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="never"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        maxFontSizeMultiplier={1.8}
        selectionColor={colors.secondary}
        style={{
          flex: 1,
          paddingVertical: spacing.sm,
          color: colors.text,
          fontFamily: fonts.regular,
          fontSize: fontSizes.md,
        }}
      />
      {value ? (
        <Pressable
          testID={testID ? `${testID}-clear` : undefined}
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={8}
          style={{ width: minTouch, height: minTouch, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontFamily: fonts.black, fontSize: 20, color: colors.textMuted }} allowFontScaling={false}>
            ✕
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
