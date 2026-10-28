import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/unit/**/*.spec.ts'],
    setupFiles: ['./test/support/setup-unit.ts'],
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/instrumentation.ts'],
    },
  },
});
