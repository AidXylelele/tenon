import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/e2e/*.spec.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    env: {
      API_BASE_URL: process.env.API_BASE_URL ?? 'http://127.0.0.1:53000',
      MAILPIT_URL: process.env.MAILPIT_URL ?? 'http://127.0.0.1:58025',
    },
  },
});
