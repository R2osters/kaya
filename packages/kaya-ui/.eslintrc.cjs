/**
 * Two rules enforce the design's boundary between @kaya/ui and the rest of
 * the system:
 *
 * 1. No colour literal outside theme/colors.ts. That file is the single
 *    source of truth for the Accra Minimalist palette; a hex or rgb/rgba/hsl
 *    literal anywhere else in this package is a duplicate that the two
 *    consuming apps can silently drift apart on -- the top divergence risk
 *    the design called out.
 * 2. No deep import of @kaya/core internals. @kaya/ui may only import from
 *    the @kaya/core package root; `@kaya/core/src/...` reaches past its
 *    barrel and couples this package to core's internal file layout.
 */
const COLOR_LITERAL_MESSAGE =
  "Colour literals belong only in theme/colors.ts. Add or reuse a token there instead of hard-coding a hex/rgb/rgba/hsl value.";

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
            group: ["@kaya/core/*"],
            message:
              "@kaya/ui must import from @kaya/core's package root, never its internals. Add the missing export to @kaya/core's barrel if it is not already public.",
          },
        ],
      },
    ],
  },
  overrides: [
    {
      // The one file allowed to contain the literal values themselves.
      files: ["src/theme/colors.ts"],
      rules: { "no-restricted-syntax": "off" },
    },
    {
      // Tests pin exact literal values (see theme.test.ts) to catch a typo
      // in colors.ts/shadows.ts that would otherwise pass silently if the
      // test asserted against the same token it was meant to check. That
      // makes the literal the point of the test, not a duplication of the
      // theme.
      files: ["src/**/*.test.ts", "src/**/*.test.tsx"],
      rules: { "no-restricted-syntax": "off" },
    },
  ],
  ignorePatterns: ["dist/"],
};
