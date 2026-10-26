import type { ConfigContext, ExpoConfig } from 'expo/config';

// Expo's config loader only transpiles this file, so register tsx to read the app name from
// src/config.ts (the single place the name lives).
require('tsx/cjs');
const { APP_BUNDLE_ID, APP_NAME, APP_SLUG, APP_VERSION } = require('./src/config') as typeof import('./src/config');

const isStoreBuild = process.env.EAS_BUILD_PROFILE === 'production';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: APP_NAME,
  slug: APP_SLUG,
  scheme: APP_SLUG,
  version: APP_VERSION,
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: false,
    bundleIdentifier: APP_BUNDLE_ID,
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: APP_BUNDLE_ID,
    adaptiveIcon: {
      backgroundColor: '#FF4F64',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    // Fully offline: store builds ship without the network permission (PRD F8).
    // Dev builds keep it so they can reach the Metro bundler.
    blockedPermissions: isStoreBuild ? ['android.permission.INTERNET'] : [],
  },
  web: { favicon: './assets/favicon.png', output: 'single' },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-sqlite',
    ['expo-audio', { microphonePermission: false, recordAudioAndroid: false, enableBackgroundPlayback: false }],
    ['expo-splash-screen', { image: './assets/splash-icon.png', imageWidth: 200, backgroundColor: '#FF4F64' }],
  ],
  experiments: { typedRoutes: true },
});
