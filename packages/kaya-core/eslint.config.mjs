/**
 * @kaya/core is the platform-free half of the shared layer (design decision
 * D2): models, wire schemas, the API client's contract, i18n resources. It
 * must stay importable from anywhere, so it may not reach for React, React
 * Native, Expo or any native module — an interface is declared here and the
 * adapter that satisfies it lives in @kaya/ui.
 *
 * Flat-config translation of the former .eslintrc.cjs; see
 * ../../eslint.config.base.mjs for why the format had to move.
 */
import { commonIgnores, typescriptBase } from "../../eslint.config.base.mjs";

export default [
  { ignores: commonIgnores },
  ...typescriptBase(),
  {
    files: ["**/*.ts", "**/*.tsx"],
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
  },
];
