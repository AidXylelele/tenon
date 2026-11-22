import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const OPERATIONS = "src/operations/**";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      include: [OPERATIONS, "src/features/**", "src/libs/**"],
      exclude: ["src/**/*.stories.tsx", "src/libs/ui/components/**"],
      thresholds: {
        [OPERATIONS]: {
          lines: 75,
          branches: 75,
          functions: 75,
          statements: 75,
        },
      },
    },
  },
});
