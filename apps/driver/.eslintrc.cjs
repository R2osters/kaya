/**
 * Extends the two rules packages/kaya-ui/.eslintrc.cjs established, into the
 * app layer (design plan, phase 1C, Global Constraints):
 *
 * 1. No colour literal outside @kaya/ui/src/theme/colors.ts. An app has no
 *    legitimate reason to hold its own hex/rgb/rgba/hsl value at all -- every
 *    colour it needs is already a token on @kaya/ui's `colors` export.
 * 2. No deep import into @kaya/core or @kaya/ui internals. This app may only
 *    import from each package's root (`@kaya/core`, `@kaya/ui`), never
 *    `@kaya/core/src/...` or `@kaya/ui/src/...` -- that couples the app to
 *    internal file layout the packages are free to reshuffle.
 */
const COLOR_LITERAL_MESSAGE =
  "Colour literals do not belong in an app. Import the token from @kaya/ui's theme instead.";

module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaFeatures: { jsx: true },
  },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  env: { node: true, es2022: true },
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector: "Literal[value=/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]",
        message: COLOR_LITERAL_MESSAGE,
      },
      {
        selector: "Literal[value=/^(rgb|rgba|hsl)\\(/i]",
        message: COLOR_LITERAL_MESSAGE,
      },
    ],
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["@kaya/core/*", "@kaya/ui/*"],
            message:
              "Import from the package root (@kaya/core or @kaya/ui), never its internals. Add the missing export to the package's barrel if it is not already public.",
          },
        ],
      },
    ],
  },
  overrides: [
    {
      // Native launch-screen config (splash.backgroundColor,
      // android.adaptiveIcon.backgroundColor) is generated before the JS
      // tree mounts, so it sits outside this rule the same way
      // packages/kaya-ui/src/theme/colors.ts itself does -- see the comment
      // on APP_NAME in app.config.ts.
      files: ["app.config.ts"],
      rules: { "no-restricted-syntax": "off" },
    },
    {
      // Tests exercising app.config.ts's build-time guard need a plain
      // require() so jest.resetModules() forces a fresh module evaluation
      // per case -- an import would be hoisted and cached once.
      files: ["src/**/*.test.ts", "src/**/*.test.tsx"],
      rules: { "@typescript-eslint/no-require-imports": "off" },
    },
  ],
  ignorePatterns: ["node_modules/", ".expo/", "android/", "ios/", "dist/"],
};
