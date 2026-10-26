import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  type ScrollViewInstance,
  View,
} from 'react-native';

import { DEFAULTS } from '../src/config';
import { useSettings } from '../src/store/settings';
import { AppText, Button, Screen, useTheme } from '../src/ui';

interface Step {
  art: string;
  bg: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    art: '🗣️📱',
    bg: '#1F7AE0',
    title: 'Describe it',
    body: 'Sit in a circle, teams alternating. Whoever holds the phone describes the phrase to their team. No saying any word in it, no rhymes, no spelling!',
  },
  {
    art: '🙌✅',
    bg: '#009E83',
    title: 'Blurt it, pass it',
    body: 'When your team shouts the answer, tap Got it and pass the phone to the next player: an opponent. Stuck? Use a skip.',
  },
  {
    art: '💣💥',
    bg: '#D9478F',
    title: "Don't get caught",
    body: `A hidden fuse ticks faster and faster. Whoever holds the phone when it blows gives every other team a point. First to ${DEFAULTS.targetScore} wins! Tied at the top? Sudden death: play on until one team pulls ahead.`,
  },
];

export default function HowToPlay() {
  const { colors, spacing, radii, reduceMotion } = useTheme();
  const [page, setPage] = useState(0);
  const [width, setWidth] = useState(0);
  const scroller = useRef<ScrollViewInstance>(null);
  /** Page a Next/Back tap is animating to; swipe tracking is ignored until it gets there. */
  const scrollingTo = useRef<number | null>(null);

  const finish = () => {
    useSettings.getState().set('hasSeenTutorial', true);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const goTo = (i: number) => {
    setPage(i);
    scrollingTo.current = i;
    setTimeout(() => {
      if (scrollingTo.current === i) scrollingTo.current = null;
    }, 800);
    scroller.current?.scrollTo({ x: i * width, animated: !reduceMotion });
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width === 0) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (scrollingTo.current !== null) {
      if (Math.abs(e.nativeEvent.contentOffset.x - scrollingTo.current * width) < 2) scrollingTo.current = null;
      return;
    }
    if (i !== page && i >= 0 && i < STEPS.length) setPage(i);
  };

  const last = page === STEPS.length - 1;

  return (
    <Screen testID="how-to-play-screen">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="title" accessibilityRole="header">
          How to Play
        </AppText>
        <Button label="Skip" variant="ghost" size="sm" onPress={finish} testID="tutorial-skip" />
      </View>

      <View style={{ flex: 1 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <ScrollView
            ref={scroller}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={32}
          >
            {STEPS.map((step, i) => (
              <View
                key={step.title}
                style={{ width, justifyContent: 'center', alignItems: 'center', gap: spacing.lg, padding: spacing.md }}
                accessibilityElementsHidden={i !== page}
                importantForAccessibility={i === page ? 'auto' : 'no-hide-descendants'}
              >
                <View
                  style={{
                    width: 200,
                    height: 200,
                    borderRadius: radii.pill,
                    backgroundColor: step.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  accessible={false}
                  importantForAccessibility="no-hide-descendants"
                  accessibilityElementsHidden
                  aria-hidden
                >
                  <AppText variant="display" align="center" decorative>
                    {step.art}
                  </AppText>
                </View>
                <AppText variant="title" align="center" accessibilityRole="header" testID={`tutorial-title-${i}`}>
                  {step.title}
                </AppText>
                <AppText variant="body" align="center">
                  {step.body}
                </AppText>
              </View>
            ))}
          </ScrollView>
        ) : null}
      </View>

      <View style={{ gap: spacing.sm }}>
        <View
          style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, alignItems: 'center' }}
          accessible
          accessibilityLabel={`Step ${page + 1} of ${STEPS.length}`}
        >
          {STEPS.map((s, i) => (
            <View
              key={s.title}
              style={{
                width: i === page ? 24 : 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: i === page ? colors.primary : colors.textMuted,
              }}
            />
          ))}
          <AppText variant="caption" color={colors.textMuted}>
            {page + 1}/{STEPS.length}
          </AppText>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button
              label="Back"
              variant="secondary"
              fullWidth
              disabled={page === 0}
              onPress={() => goTo(page - 1)}
              testID="tutorial-back"
            />
          </View>
          <View style={{ flex: 2 }}>
            <Button
              label={last ? "Let's play!" : 'Next'}
              variant="primary"
              size="lg"
              fullWidth
              onPress={last ? finish : () => goTo(page + 1)}
              testID="tutorial-next"
            />
          </View>
        </View>
      </View>
    </Screen>
  );
}
