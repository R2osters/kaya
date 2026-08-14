// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules', 'coverage', '*.js', '*.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.ts'],
    plugins: { sonarjs },
    rules: {
      ...sonarjs.configs.recommended.rules,
      // NestJS DI relies on empty constructors / injected classes with no members.
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'default', format: ['camelCase'] },
        { selector: 'variableLike', format: ['camelCase'], leadingUnderscore: 'allow' },
        // Module-level constants (SCREAMING_SNAKE_CASE) are an established
        // convention across this codebase (common/constants.ts, provider files).
        {
          selector: 'variable',
          modifiers: ['const'],
          format: ['camelCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
        },
        // NestJS decorator factories are consts holding a function, exported
        // in PascalCase by framework convention (@CurrentUser, @Public, @Roles).
        {
          selector: 'variable',
          types: ['function'],
          format: ['camelCase', 'PascalCase'],
        },
        {
          selector: 'variable',
          types: ['boolean'],
          format: ['PascalCase'],
          prefix: ['is', 'should', 'has', 'can', 'did', 'will'],
        },
        { selector: 'typeLike', format: ['PascalCase'] },
        // Enum members mirror Prisma enum values (snake_case) elsewhere in the
        // schema (TransactionType, NotificationType, ...) - keep consistent.
        { selector: 'enumMember', format: ['UPPER_CASE', 'PascalCase', 'camelCase', 'snake_case'] },
        {
          selector: 'objectLiteralProperty',
          format: null,
          modifiers: ['requiresQuotes'],
        },
        { selector: 'objectLiteralProperty', format: null },
        { selector: 'import', format: ['camelCase', 'PascalCase'] },
        { selector: 'property', format: null },
      ],
      // Prisma/DTO decorated class properties use `!:` non-null assertions by design.
      '@typescript-eslint/no-non-null-assertion': 'off',
      'sonarjs/todo-tag': 'off',
      'sonarjs/cognitive-complexity': ['warn', 20],
      // Leading underscore is the established "intentionally unused" signal
      // (destructure-to-drop a field, unused interface param) across this codebase.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
      'sonarjs/no-unused-vars': 'off',
    },
  },
  {
    // Tests: jest mocks and supertest's app/response bodies are untyped by
    // nature, and fixture credentials are not real secrets.
    files: ['**/*.spec.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/no-hardcoded-passwords': 'off',
      'sonarjs/pseudo-random': 'off',
    },
  },
  {
    // socket.io's Socket#data / handshake payloads are untyped (any) upstream;
    // this module is the single narrow boundary where that any is unwrapped.
    files: ['src/realtime/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },
  eslintConfigPrettier,
);
