import { useEffect, useRef, useState } from 'react';
import {
  Text,
  View,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type HostInstance,
  type LayoutChangeEvent,
} from 'react-native';

import { AppText } from './AppText';
import { moveThumb, nearestThumb, fromFraction, toFraction, type Thumb } from './rangeMath';
import { chunkyShadow, fonts, fontSizes, minTouch, radii, spacing } from './tokens';
import { useTheme } from './theme';
import type { RangeSliderProps } from './types';

const THUMB = 34;
const TRACK_H = 14;

interface Snapshot {
  min: number;
  max: number;
  step: number;
  low: number;
  high: number;
  onChange: (low: number, high: number) => void;
  width: number;
}

/** Value under a track-relative x (px). */
function valueAt(c: Snapshot, x: number): number {
  const usable = Math.max(1, c.width - THUMB);
  return fromFraction((x - THUMB / 2) / usable, c.min, c.max, c.step);
}

function apply(c: Snapshot, thumb: Thumb, v: number) {
  const [nl, nh] = moveThumb(thumb, v, c.low, c.high, c.min, c.max, c.step);
  if (nl !== c.low || nh !== c.high) c.onChange(nl, nh);
}

/**
 * Two-thumb range slider (RN responder system; no gesture-handler dependency). Drag anywhere on the
 * track: the nearer thumb follows. Thumbs never cross (low <= high). Each thumb is its own
 * "adjustable" element for VoiceOver/TalkBack (swipe up/down = one step).
 */
export function RangeSlider({ label, min, max, step, low, high, onChange, format, testID }: RangeSliderProps) {
  const { colors } = useTheme();
  const f = format ?? String;
  const [width, setWidth] = useState(0);

  // Touch handlers read the latest props through a ref.
  const latest = useRef<Snapshot>({ min, max, step, low, high, onChange, width });
  useEffect(() => {
    latest.current = { min, max, step, low, high, onChange, width };
  });
  const trackRef = useRef<HostInstance>(null);
  /** Track's page x while dragging (touch coordinates are page-relative). */
  const drag = useRef<{ thumb: Thumb | null; origin: number | null; pageX: number } | null>(null);

  // Plain responder-system handlers (no PanResponder object needed). Touch x is page-relative,
  // so the track's page offset is measured when a drag starts.
  const onGrant = (e: GestureResponderEvent) => {
    const d = { thumb: null as Thumb | null, origin: null as number | null, pageX: e.nativeEvent.pageX };
    drag.current = d;
    trackRef.current?.measure((_x, _y, _w, _h, pageX) => {
      if (drag.current !== d) return;
      const c = latest.current;
      d.origin = pageX;
      const v = valueAt(c, d.pageX - pageX);
      d.thumb = nearestThumb(v, c.low, c.high);
      apply(c, d.thumb, v);
    });
  };
  const onMove = (e: GestureResponderEvent) => {
    const d = drag.current;
    if (!d) return;
    d.pageX = e.nativeEvent.pageX;
    if (d.thumb && d.origin !== null) apply(latest.current, d.thumb, valueAt(latest.current, d.pageX - d.origin));
  };
  const onEnd = () => {
    drag.current = null;
  };

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const usable = Math.max(0, width - THUMB);
  const lowX = toFraction(low, min, max) * usable;
  const highX = toFraction(high, min, max) * usable;

  const onThumbAction = (thumb: Thumb) => (e: AccessibilityActionEvent) => {
    const cur = thumb === 'low' ? low : high;
    const delta =
      e.nativeEvent.actionName === 'increment' ? step : e.nativeEvent.actionName === 'decrement' ? -step : 0;
    if (delta) apply({ min, max, step, low, high, onChange, width }, thumb, cur + delta);
  };

  const thumbView = (thumb: Thumb, x: number) => {
    const v = thumb === 'low' ? low : high;
    return (
      <View
        key={thumb}
        testID={testID ? `${testID}-${thumb}` : undefined}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`${label}, ${thumb === 'low' ? 'minimum' : 'maximum'}`}
        accessibilityValue={{ min, max, now: v, text: f(v) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onThumbAction(thumb)}
        style={{
          position: 'absolute',
          left: x + THUMB / 2 - minTouch / 2,
          top: 0,
          width: minTouch,
          height: minTouch,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: THUMB,
            height: THUMB,
            borderRadius: THUMB / 2,
            backgroundColor: colors.surface,
            borderWidth: chunkyShadow.borderWidth,
            borderColor: colors.border,
            // Chunky look: a solid "shadow" offset under the knob.
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 1,
            shadowRadius: 0,
            elevation: 3,
          }}
        />
      </View>
    );
  };

  return (
    <View testID={testID} style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: spacing.sm }}>
        <View style={{ flex: 1, minWidth: 140 }}>
          <AppText variant="label">{label}</AppText>
        </View>
        <Text
          testID={testID ? `${testID}-value` : undefined}
          maxFontSizeMultiplier={1.4}
          style={{ fontFamily: fonts.black, fontSize: fontSizes.lg, lineHeight: 30, color: colors.text }}
        >
          {low === high ? f(low) : `${f(low)} – ${f(high)}`}
        </Text>
      </View>
      <View
        ref={trackRef}
        onLayout={onLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={onGrant}
        onResponderMove={onMove}
        onResponderRelease={onEnd}
        onResponderTerminate={onEnd}
        style={{ height: minTouch, justifyContent: 'center' }}
      >
        <View
          pointerEvents="none"
          style={{
            marginHorizontal: THUMB / 2,
            height: TRACK_H,
            borderRadius: radii.pill,
            backgroundColor: colors.track,
            borderWidth: 2,
            borderColor: colors.border,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: lowX,
              width: Math.max(0, highX - lowX),
              backgroundColor: colors.secondary,
            }}
          />
        </View>
        {thumbView('low', lowX)}
        {thumbView('high', highX)}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <AppText variant="caption" decorative>
          {f(min)}
        </AppText>
        <AppText variant="caption" decorative>
          {f(max)}
        </AppText>
      </View>
    </View>
  );
}
