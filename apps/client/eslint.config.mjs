/**
 * Extends the two rules packages/kaya-ui established, into the app layer
 * (design plan, phase 1C, Global Constraints):
 *
 * 1. No colour literal outside @kaya/ui/src/theme/colors.ts. An app has no
 *    legitimate reason to hold its own hex/rgb/rgba/hsl value at all — every
 *    colour it needs is already a token on @kaya/ui's `colors` export.
 * 2. No deep import into @kaya/core or @kaya/ui internals. This app may only
 *    import from each package's root (`@kaya/core`, `@kaya/ui`), never
 *    `@kaya/core/src/...` or `@kaya/ui/src/...` — that couples the app to
 *    internal file layout the packages are free to reshuffle.
 *
 * Flat-config translation of the former .eslintrc.cjs; see
 * ../../eslint.config.base.mjs for why the format had to move.
 */
import { commonIgnores, noColourLiterals, typescriptBase } from "../../eslint.config.base.mjs";

const COLOR_LITERAL_MESSAGE =
  "Colour literals do not belong in an app. Import the token from @kaya/ui's theme instead.";

export default [
  { ignores: [...commonIgnores, "**/.expo/**", "**/android/**", "**/ios/**"] },
  ...typescriptBase({ jsx: true }),
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      ...noColourLiterals(COLOR_LITERAL_MESSAGE),
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
  },
  {
    // Native launch-screen config (splash.backgroundColor,
    // android.adaptiveIcon.backgroundColor) is generated before the JS tree
    // mounts, so it sits outside this rule the same way
    // packages/kaya-ui/src/theme/colors.ts itself does — see the comment on
    // APP_NAME in app.config.ts.
    files: ["app.config.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    // Tests exercising app.config.ts's build-time guard need a plain
    // require() so jest.resetModules() forces a fresh module evaluation per
    // case — an import would be hoisted and cached once. app/routes.test.tsx
    // requires each route file individually for the same reason: one broken
    // route fails its own row instead of aborting the suite.
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
];
