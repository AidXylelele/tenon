import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["test/unit/**/*.spec.ts"],
          setupFiles: ["./test/support/setup-unit.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: [
            "test/integration/**/*.spec.ts",
            "test/component/**/*.spec.ts",
          ],
          globalSetup: ["./test/support/global-setup.ts"],
          setupFiles: ["./test/support/setup-env.ts"],
          fileParallelism: false,
          execArgv: ["--import", "./test/support/typescript-threads.mjs"],
          hookTimeout: 120_000,
          testTimeout: 30_000,
        },
      },
      {
        extends: true,
        test: {
          name: "e2e",
          include: ["test/e2e/*.spec.ts"],
          fileParallelism: false,
          testTimeout: 60_000,
        },
      },
    ],
  },
});
