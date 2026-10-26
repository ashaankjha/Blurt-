// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'node_modules/*', '.expo/*', '.claude/*', 'content/packs/index.ts'],
  },
  {
    // The engine is pure TypeScript: no React, React Native or Expo.
    files: ['src/engine/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['react', 'react-native', 'react-native-*', 'expo', 'expo-*', '@expo/*', 'zustand'] },
      ],
    },
  },
]);
