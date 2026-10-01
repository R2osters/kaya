/**
 * Shared ESLint flat-config pieces for the workspace.
 *
 * Every package used to carry an `.eslintrc.cjs` and run ESLint with
 * `ESLINT_USE_FLAT_CONFIG=false`. ESLint 9.39 no longer honours that escape
 * hatch, so `npm run lint` failed to start in all four workspaces with
 * "couldn't find an eslint.config.(js|mjs|cjs) file" — which meant the two
 * rules the design leans on hardest, the colour-literal ban and the
 * deep-import ban, had quietly stopped being enforced anywhere, in CI
 * included. This is the flat-config translation of those files.
 *
 * The rule text is unchanged; only the config format moved.
 */
import js from "@eslint/js";
import tseslint from "typescript-eslint";

/** Build outputs and native projects, ignored everywhere. */
export const commonIgnores = ["**/node_modules/**", "**/dist/**"];

/**
 * `eslint:recommended` + `plugin:@typescript-eslint/recommended`, scoped to
 * TypeScript sources — the flat equivalent of every package's `extends`.
 */
export function typescriptBase({ files = ["**/*.ts", "**/*.tsx"], jsx = false } = {}) {
  return [
    { files, ...js.configs.recommended },
    ...tseslint.configs.recommended.map((config) => ({ ...config, files })),
    {
      files,
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: {
          ecmaVersion: 2022,
          sourceType: "module",
          ...(jsx ? { ecmaFeatures: { jsx: true } } : {}),
        },
        globals: {
          console: "readonly",
          process: "readonly",
          setTimeout: "readonly",
          clearTimeout: "readonly",
          setInterval: "readonly",
          clearInterval: "readonly",
          fetch: "readonly",
          __DEV__: "readonly",
        },
      },
    },
  ];
}

/**
 * Bans hex/rgb/rgba/hsl literals. The palette lives in exactly one file
 * (@kaya/ui's theme/colors.ts); a literal anywhere else is a duplicate the two
 * apps can silently drift apart on.
 */
export function noColourLiterals(message) {
  return {
    "no-restricted-syntax": [
      "error",
      {
        selector: "Literal[value=/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]",
        message,
      },
      {
        selector: "Literal[value=/^(rgb|rgba|hsl)\\(/i]",
        message,
      },
    ],
  };
}
