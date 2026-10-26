/**
 * Mirrors `accessibilityState` / `accessibilityValue` into the equivalent `aria-*` props.
 *
 * React Native (iOS/Android) reads either form. react-native-web 0.21 ignores the object props and
 * reads only `aria-*`, so without this, web screen readers (and Playwright's accessibility
 * snapshots) never hear "checked", "selected" or a slider's value. Spread the result next to the
 * object props: `<Pressable accessibilityState={s} {...ariaProps(s)} />`.
 */
import type { AccessibilityState, AccessibilityValue } from 'react-native';

export interface AriaProps {
  'aria-checked'?: boolean | 'mixed';
  'aria-selected'?: boolean;
  'aria-disabled'?: boolean;
  'aria-busy'?: boolean;
  'aria-expanded'?: boolean;
  'aria-valuemin'?: number;
  'aria-valuemax'?: number;
  'aria-valuenow'?: number;
  'aria-valuetext'?: string;
}

export function ariaProps(state?: AccessibilityState | null, value?: AccessibilityValue | null): AriaProps {
  const out: AriaProps = {};
  if (state) {
    if (state.checked !== undefined && state.checked !== null) out['aria-checked'] = state.checked;
    if (state.selected !== undefined) out['aria-selected'] = state.selected;
    if (state.disabled !== undefined) out['aria-disabled'] = state.disabled;
    if (state.busy !== undefined) out['aria-busy'] = state.busy;
    if (state.expanded !== undefined) out['aria-expanded'] = state.expanded;
  }
  if (value) {
    if (value.min !== undefined) out['aria-valuemin'] = value.min;
    if (value.max !== undefined) out['aria-valuemax'] = value.max;
    if (value.now !== undefined) out['aria-valuenow'] = value.now;
    if (value.text !== undefined) out['aria-valuetext'] = value.text;
  }
  return out;
}
