/**
 * @kaya/core must stay platform-free: decision D2 in the migration design.
 * Importing react-native here would force every consumer of the money helpers
 * to boot a React Native test environment.
 */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  env: { node: true, es2022: true },
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["react", "react-native", "react-native/*", "expo", "expo-*", "@react-native-firebase/*"],
            message:
              "@kaya/core must not import platform packages (design decision D2). Declare an interface here and put the adapter in @kaya/ui.",
          },
        ],
      },
    ],
  },
  ignorePatterns: ["dist/"],
};
