import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const frameworkPackages = [
  '@nestjs/*',
  '@nestjs-cls/*',
  'nestjs-cls',
  'nestjs-pino',
  'pino',
  'pino-http',
  'drizzle-orm',
  'drizzle-orm/*',
  'pg',
  '@opentelemetry/*',
  'zod',
  'class-validator',
  'class-transformer',
  'express',
  'rxjs',
];

const layer = (groups) => ({
  'no-restricted-imports': [
    'error',
    {
      patterns: groups.map((group) => ({
        group,
        message: `Layer boundary: "${group[0]}" is not allowed here.`,
      })),
    },
  ],
});

export default defineConfig(
  globalIgnores(['dist/**', 'coverage/**', 'drizzle/**']),
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: layer([
      ['**/application/**'],
      ['**/interface-adapters/**'],
      ['**/frameworks/**'],
      ...frameworkPackages.map((name) => [name]),
    ]),
  },
  {
    files: ['src/application/**/*.ts'],
    rules: layer([
      ['**/interface-adapters/**'],
      ['**/frameworks/**'],
      ...frameworkPackages.map((name) =>
        name === '@nestjs/*' ? [name, '!@nestjs/authorization'] : [name],
      ),
    ]),
  },
  {
    files: ['src/interface-adapters/**/*.ts'],
    rules: layer([['**/frameworks/**']]),
  },
  {
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/require-await': 'off',
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
