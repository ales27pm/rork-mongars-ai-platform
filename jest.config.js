/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': [
      'babel-jest',
      { presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]] },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|expo-.*|@expo(nent)?/.*|@expo-google-fonts/.*|@use-expo/.*|@unimodules/.*|unimodules-.*|sentry-expo|native-base|react-native-svg|@callstack/.*|@react-navigation/.*|llama3-tokenizer-js(/.*)?)/)',
  ],
};
