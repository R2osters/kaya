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
            group: [
              "react",
              "react/*",
              "react-dom",
              "react-dom/*",
              "react-native",
              "react-native/*",
              "react-native-*",
              // The i18n module ships resources and a bare i18next instance;
              // the React binding is an adapter and belongs to @kaya/ui.
              "react-i18next",
              "expo",
              "expo-*",
              "@expo/*",
              "@react-native-firebase/*",
              "@react-native-async-storage/*",
              "@react-navigation/*",
            ],
            message:
              "@kaya/core must not import platform packages (design decision D2). Declare an interface here and put the adapter in @kaya/ui.",
          },
        ],
      },
    ],
  },
  ignorePatterns: ["dist/"],
};
