import { ScrollView, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WHITE, readableTextOn } from './color';
import { spacing } from './tokens';
import { ThemeProvider, useTheme } from './theme';
import type { ScreenProps } from './types';

function ScreenBody({ children, tint, scroll, padded = true, contentStyle, testID }: Omit<ScreenProps, 'scheme'>) {
  const { colors } = useTheme();
  const bg = tint ?? colors.background;
  const pad = padded ? spacing.md : 0;
  return (
    <SafeAreaView testID={testID} style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar style={readableTextOn(bg) === WHITE ? 'light' : 'dark'} />
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[{ flexGrow: 1, padding: pad }, contentStyle]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, padding: pad }, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

/**
 * Screen root: safe area, themed background (or `tint`), optional scroll and padding, and a
 * status bar that contrasts with the background. `scheme` forces light/dark for this screen
 * and everything inside it (Round and Caught use 'dark').
 *
 * For the Round screen's team tint, pass a deep shade (`TEAM_COLORS[i].deep` or
 * `teamBackground(hex)`) so white text stays readable.
 */
export function Screen({ scheme, ...rest }: ScreenProps) {
  if (!scheme) return <ScreenBody {...rest} />;
  return (
    <ThemeProvider scheme={scheme}>
      <ScreenBody {...rest} />
    </ThemeProvider>
  );
}
