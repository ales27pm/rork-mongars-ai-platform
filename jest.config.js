module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|expo-.*|@expo(nent)?/.*|@expo-google-fonts/.*|@use-expo/.*|@unimodules/.*|unimodules-.*|sentry-expo|native-base|react-native-svg|@callstack/.*|@react-navigation/.*|llama3-tokenizer-js)/)',
  ],
};
