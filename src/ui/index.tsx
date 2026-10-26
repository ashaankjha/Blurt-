/**
 * Design system. Phase 0 STUBS: plain, unstyled-but-working components so screens can be built
 * in parallel. Agent E replaces them (and may split into files), keeping these exports and the
 * props in ./types.
 */
import { createContext, useContext } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fontSizes, fonts, palette, radii, spacing, TEAM_COLORS } from './tokens';
import type {
  AppTextProps,
  ButtonProps,
  CardProps,
  ChipProps,
  ConfettiProps,
  FuseBarProps,
  IconButtonProps,
  PackTileProps,
  PhraseTextProps,
  RangeSliderProps,
  ScoreRowProps,
  ScreenProps,
  SearchFieldProps,
  SegmentedProps,
  StepperProps,
  TeamCardProps,
  TextFieldProps,
  Theme,
  ThemeProviderProps,
  ToggleRowProps,
} from './types';

export * from './tokens';
export * from './types';

const lightTheme: Theme = {
  scheme: 'light',
  colors: palette.light,
  fonts,
  fontSizes,
  spacing,
  radii,
  reduceMotion: false,
};
const ThemeContext = createContext<Theme>(lightTheme);

export function ThemeProvider({ children }: ThemeProviderProps) {
  return <ThemeContext.Provider value={lightTheme}>{children}</ThemeContext.Provider>;
}

export const useTheme = (): Theme => useContext(ThemeContext);

export function Screen({ children, tint, scroll, testID }: ScreenProps) {
  const body = scroll ? <ScrollView>{children}</ScrollView> : children;
  return (
    <SafeAreaView
      testID={testID}
      style={{ flex: 1, padding: spacing.md, backgroundColor: tint ?? palette.light.background }}
    >
      {body}
    </SafeAreaView>
  );
}

export function AppText({ children, align, color, numberOfLines, style, accessibilityRole, testID }: AppTextProps) {
  return (
    <Text
      testID={testID}
      accessibilityRole={accessibilityRole}
      numberOfLines={numberOfLines}
      style={[{ textAlign: align, color }, style]}
    >
      {children}
    </Text>
  );
}

export function Button({ label, onPress, onLongPress, disabled, icon, accessibilityLabel, testID }: ButtonProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      style={{ padding: spacing.md, borderWidth: 2, borderRadius: radii.md, marginVertical: spacing.xs }}
    >
      <Text>{icon ? `${icon} ${label}` : label}</Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  onLongPress,
  accessibilityLabel,
  delayLongPress,
  testID,
}: IconButtonProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      style={{ padding: spacing.sm }}
    >
      <Text>{icon}</Text>
    </Pressable>
  );
}

export function PhraseText({ text, hidden, color, testID }: PhraseTextProps) {
  return (
    <Text testID={testID} style={{ fontSize: fontSizes.phraseMin, textAlign: 'center', color }}>
      {hidden ? '• • •' : text}
    </Text>
  );
}

export function TeamCard({ team, onChange, onRemove, canRemove }: TeamCardProps) {
  return (
    <View style={{ borderLeftWidth: 8, borderColor: team.color, padding: spacing.sm, marginVertical: spacing.xs }}>
      <TextInput value={team.name} onChangeText={(name) => onChange({ name })} accessibilityLabel="Team name" />
      <View style={{ flexDirection: 'row' }}>
        {TEAM_COLORS.map((c) => (
          <Pressable
            key={c.hex}
            accessibilityLabel={c.name}
            onPress={() => onChange({ color: c.hex })}
            style={{ width: 24, height: 24, backgroundColor: c.hex, margin: 2 }}
          />
        ))}
      </View>
      {canRemove ? <Button label="Remove" onPress={onRemove} /> : null}
    </View>
  );
}

export function PackTile({ pack, selected, onToggle, testID }: PackTileProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onToggle}
      style={{ padding: spacing.sm, borderWidth: selected ? 3 : 1, margin: spacing.xs }}
    >
      <Text>
        {pack.emoji} {pack.name} ({pack.phraseCount})
      </Text>
    </Pressable>
  );
}

export function Stepper({ label, value, min, max, step = 1, onChange, format, testID }: StepperProps) {
  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Text>{label}</Text>
      <Button
        label="−"
        onPress={() => onChange(Math.max(min, value - step))}
        accessibilityLabel={`Decrease ${label}`}
      />
      <Text>{format ? format(value) : value}</Text>
      <Button
        label="+"
        onPress={() => onChange(Math.min(max, value + step))}
        accessibilityLabel={`Increase ${label}`}
      />
    </View>
  );
}

export function RangeSlider({ label, low, high, min, max, step, onChange, format, testID }: RangeSliderProps) {
  const f = format ?? String;
  return (
    <View testID={testID}>
      <Text>
        {label}: {f(low)} – {f(high)}
      </Text>
      <Stepper
        label="Min"
        value={low}
        min={min}
        max={high}
        step={step}
        onChange={(v) => onChange(v, high)}
        format={f}
      />
      <Stepper label="Max" value={high} min={low} max={max} step={step} onChange={(v) => onChange(low, v)} format={f} />
    </View>
  );
}

export function Segmented<T>({ label, options, value, onChange, testID }: SegmentedProps<T>) {
  return (
    <View testID={testID}>
      {label ? <Text>{label}</Text> : null}
      <View style={{ flexDirection: 'row' }}>
        {options.map((o) => (
          <Pressable
            key={o.label}
            accessibilityRole="radio"
            accessibilityState={{ selected: o.value === value }}
            onPress={() => onChange(o.value)}
            style={{ padding: spacing.sm, borderWidth: o.value === value ? 3 : 1 }}
          >
            <Text>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function ToggleRow({ label, description, value, onChange, testID }: ToggleRowProps) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View>
        <Text>{label}</Text>
        {description ? <Text>{description}</Text> : null}
      </View>
      <Switch testID={testID} accessibilityLabel={label} value={value} onValueChange={onChange} />
    </View>
  );
}

export function Card({ children, color, style, testID }: CardProps) {
  return (
    <View
      testID={testID}
      style={[{ borderWidth: 2, borderColor: color, padding: spacing.md, borderRadius: radii.md }, style]}
    >
      {children}
    </View>
  );
}

export function Chip({ label, selected, onPress, testID }: ChipProps) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}>
      <Text style={{ fontWeight: selected ? 'bold' : 'normal' }}>{label}</Text>
    </Pressable>
  );
}

export function ScoreRow({ team, score, target, delta, testID }: ScoreRowProps) {
  return (
    <View testID={testID} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ color: team.color }}>{team.name}</Text>
      <Text>
        {score}/{target} {delta ? `+${delta}` : ''}
      </Text>
    </View>
  );
}

export function Confetti(_: ConfettiProps) {
  return null;
}

export function FuseBar({ progress }: FuseBarProps) {
  return (
    <View style={{ height: 8, backgroundColor: '#ccc' }}>
      <View style={{ height: 8, width: `${Math.round(progress * 100)}%`, backgroundColor: '#f00' }} />
    </View>
  );
}

export function TextField({ label, value, onChangeText, placeholder, maxLength, testID }: TextFieldProps) {
  return (
    <View>
      <Text>{label}</Text>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        maxLength={maxLength}
      />
    </View>
  );
}

export function SearchField({ value, onChangeText, placeholder, testID }: SearchFieldProps) {
  return (
    <TextInput
      testID={testID}
      accessibilityLabel={placeholder ?? 'Search'}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
    />
  );
}

/** Component gallery (storybook-style) rendered in light and dark. */
export function Gallery() {
  return <AppText>Gallery</AppText>;
}
