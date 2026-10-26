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
  testID?: string;
}

export interface PhraseTextProps {
  text: string;
  color?: string;
  /** When true, render a neutral placeholder instead of the phrase (paused). */
  hidden?: boolean;
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
  testID?: string;
}

export interface ToggleRowProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
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
}

export interface FuseBarProps {
  /** 0 = just lit, 1 = blown. */
  progress: number;
}

export interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  maxLength?: number;
  testID?: string;
}

export interface SearchFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  testID?: string;
}
