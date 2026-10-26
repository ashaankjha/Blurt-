/**
 * Design-system component props. FROZEN after Phase 0 (orchestrator): screens in app/ build
 * against these while Agent E implements them. E may add optional props, never remove or rename.
 */
import type { ReactNode } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

import type { PackMeta } from '../../content/schema';
import type { Team } from '../engine/types';
import type { ColorScheme, Palette, fontSizes, fonts, radii, spacing } from './tokens';

export interface Theme {
  scheme: ColorScheme;
  colors: Palette;
  fonts: typeof fonts;
  fontSizes: typeof fontSizes;
  spacing: typeof spacing;
  radii: typeof radii;
  /** True when the OS asks for reduced motion. */
  reduceMotion: boolean;
}

export interface ThemeProviderProps {
  /** 'system' follows the OS. Default 'system'. */
  scheme?: ColorScheme | 'system';
  /** (E, optional) Override the OS reduce-motion setting (tests, gallery). */
  reduceMotion?: boolean;
  children: ReactNode;
}

export interface ScreenProps {
  children: ReactNode;
  /** Force a scheme for this screen (Round/Caught use 'dark'). */
  scheme?: ColorScheme;
  /** Background tint color (e.g. holder team color on Round). */
  tint?: string;
  /** Wrap content in a ScrollView. */
  scroll?: boolean;
  /** Extra padding inside safe area. Default true. */
  padded?: boolean;
  /** (E, optional) Style for the inner content container. */
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

export type TextVariant = 'display' | 'title' | 'heading' | 'body' | 'caption' | 'label';

export interface AppTextProps {
  children: ReactNode;
  variant?: TextVariant;
  color?: string;
  align?: 'left' | 'center' | 'right';
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  accessibilityRole?: 'header' | 'text' | 'summary';
  /** (E, optional) Overrides the variant's Dynamic Type cap. */
  maxFontSizeMultiplier?: number;
  /** (E, optional) Hide from screen readers (decorative text). */
  decorative?: boolean;
  testID?: string;
}

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Emoji or single glyph shown before the label. */
  icon?: string;
  /** Overrides the variant background (e.g. a team color). */
  color?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  /** (E, optional) Ignore presses within this many ms of the last accepted one (Got it: 300). */
  debounceMs?: number;
  testID?: string;
}

export interface IconButtonProps {
  /** Emoji or glyph. */
  icon: string;
  onPress: () => void;
  onLongPress?: () => void;
  /** Required: icon-only controls need a screen-reader label. */
  accessibilityLabel: string;
  size?: 'sm' | 'md' | 'lg';
  /** ms the user must hold before onLongPress fires. */
  delayLongPress?: number;
  /** (E, optional) */
  accessibilityHint?: string;
  /** (E, optional) Face color. Default theme surface. */
  color?: string;
  /** (E, optional) */
  disabled?: boolean;
  testID?: string;
}

export interface PhraseTextProps {
  text: string;
  color?: string;
  /** When true, render a neutral placeholder instead of the phrase (paused). */
  hidden?: boolean;
  /** (E, optional) Text shown in the paused placeholder. Default "Paused". */
  hiddenLabel?: string;
  /** (E, optional) Largest font size to try. Default fontSizes.phraseMax. */
  maxFontSize?: number;
  testID?: string;
}

export interface TeamCardProps {
  team: Team;
  index: number;
  canRemove: boolean;
  onChange: (patch: Partial<Omit<Team, 'id'>>) => void;
  onRemove: () => void;
  /** Colors already taken by other teams (disabled in the picker). */
  usedColors: string[];
  /** Show the optional player-name editor. Default true. */
  showPlayers?: boolean;
  /** (E, optional) Max team name length. Default 20. */
  maxNameLength?: number;
  testID?: string;
}

export interface PackTileProps {
  pack: PackMeta;
  selected: boolean;
  onToggle: () => void;
  testID?: string;
}

export interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  testID?: string;
}

export interface RangeSliderProps {
  label: string;
  min: number;
  max: number;
  step: number;
  low: number;
  high: number;
  onChange: (low: number, high: number) => void;
  format?: (value: number) => string;
  testID?: string;
}

export interface SegmentedOption<T> {
  value: T;
  label: string;
}

export interface SegmentedProps<T> {
  label?: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** (E, optional) Dims the group and ignores presses. */
  disabled?: boolean;
  testID?: string;
}

export interface ToggleRowProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  /** (E, optional) Dims the row and ignores presses. */
  disabled?: boolean;
  testID?: string;
}

export interface CardProps {
  children: ReactNode;
  /** Accent/border color. */
  color?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** (E, optional) Emoji or glyph before the label. */
  icon?: string;
  /** (E, optional) Fill color when selected. Default theme secondary. */
  color?: string;
  /** (E, optional) Dims the chip and ignores presses. */
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

export interface ScoreRowProps {
  team: Team;
  score: number;
  target: number;
  /** Emphasize (e.g. leader or caught team). */
  highlight?: boolean;
  /** Show an animated "+1" (or other delta) badge. */
  delta?: number;
  testID?: string;
}

export interface ConfettiProps {
  active: boolean;
  /** (E, optional) Particle colors. Default: all team colors. */
  colors?: string[];
  /** (E, optional) Number of particles. Default 60. */
  count?: number;
  /** (E, optional) Called once the burst has finished falling. */
  onDone?: () => void;
  testID?: string;
}

export interface FuseBarProps {
  /** 0 = just lit, 1 = blown. */
  progress: number;
  testID?: string;
}

export interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  maxLength?: number;
  /** (E, optional) */
  autoFocus?: boolean;
  /** (E, optional) */
  onSubmitEditing?: () => void;
  /** (E, optional) Multi-line input (e.g. paste a phrase list). */
  multiline?: boolean;
  /** (E, optional) Shown under the field; announced to screen readers. */
  error?: string;
  accessibilityHint?: string;
  testID?: string;
}

export interface SearchFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** (E, optional) Default: placeholder or "Search". */
  accessibilityLabel?: string;
  testID?: string;
}

export interface GalleryProps {
  /** (E) Which scheme(s) to show first. Default 'both'. */
  initialScheme?: ColorScheme | 'both';
}
