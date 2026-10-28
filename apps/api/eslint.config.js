import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Layer boundaries and package confinement are reviewed by people, not encoded here.
export default defineConfig(
  globalIgnores(['dist/**', 'coverage/**', 'drizzle/**']),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Type-only imports are erased by SWC; marking them keeps runtime imports (and their side effects) explicit.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports' },
      ],
      // Every member of a union handled, or an explicit default.
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      // `sort()` without a comparator compares as strings.
      '@typescript-eslint/require-array-sort-compare': 'error',
      // NestJS modules are decorated classes without members; presenters and mappers are static-method classes.
      '@typescript-eslint/no-extraneous-class': [
        'error',
        { allowWithDecorator: true, allowStaticOnly: true },
      ],
      // Numbers read fine inside template literals.
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true },
      ],
      // `() => res.end()` and `return reply(res)` inside a void function are ordinary callback shapes.
      '@typescript-eslint/no-confusing-void-expression': [
        'error',
        { ignoreArrowShorthand: true, ignoreVoidReturningFunctions: true },
      ],
      // `process.env['X']` and other index-signature reads keep bracket access.
      '@typescript-eslint/dot-notation': [
        'error',
        { allowIndexSignaturePropertyAccess: true },
      ],
      eqeqeq: ['error', 'always'],
      'no-implicit-coercion': 'error',
      'no-nested-ternary': 'error',
      'no-param-reassign': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
  {
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
