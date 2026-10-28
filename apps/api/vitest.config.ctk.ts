import { quickpickle } from 'quickpickle';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [quickpickle()],
  test: {
    globals: true,
    root: './',
    include: ['test/conformance/features/*.feature'],
    globalSetup: ['./test/support/global-setup.ts'],
    setupFiles: [
      './test/support/setup-env.ts',
      './test/conformance/steps/workflow.steps.ts',
    ],
    fileParallelism: false,
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});
