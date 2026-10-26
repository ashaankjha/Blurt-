/**
 * Blurt! design system (PRD section 5). Loud, bright, toy-like: Baloo 2 type, chunky buttons
 * that press down into a solid block, high-saturation color-blind-safe team colors.
 * Props live in ./types (frozen; optional additions only). See ./HANDOFF.md.
 */
export * from './tokens';
export * from './types';

export { ThemeProvider, useTheme, makeTheme } from './theme';
export { Screen } from './Screen';
export { AppText } from './AppText';
export { Button, IconButton, buttonColors } from './Button';
export { ChunkyPressable } from './Chunky';
export { PhraseText } from './PhraseText';
export { TeamCard } from './TeamCard';
export { PackTile, TAG_LABELS } from './PackTile';
export { Stepper, Segmented, ToggleRow } from './Controls';
export { RangeSlider } from './RangeSlider';
export { Card, Chip } from './Card';
export { ScoreRow } from './ScoreRow';
export { Confetti } from './Confetti';
export { FuseBar, fuseColorFor } from './FuseBar';
export { TextField, SearchField } from './TextField';
export { Gallery } from './Gallery';

export {
  contrastRatio,
  readableTextOn,
  shade,
  tint,
  withAlpha,
  teamBackground,
  relativeLuminance,
  simulateCvd,
  deltaE,
} from './color';
export { fitPhrase, measureBaloo } from './phraseFit';
