import { readdirSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const OPERATION_FLOOR = {
  lines: 75,
  branches: 75,
  functions: 75,
  statements: 75,
};

const LIB_FLOOR = {
  lines: 85,
  branches: 85,
  functions: 85,
  statements: 85,
};

const operations = new URL("./src/operations/", import.meta.url);

const operationFloors = readdirSync(operations, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => [`src/operations/${entry.name}/**`, OPERATION_FLOOR]);

const libFloors = [
  ["src/libs/code-formatting/**", LIB_FLOOR],
  ["src/libs/codemirror/**", LIB_FLOOR],
];

const floors = operationFloors.concat(libFloors);

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
      include: ["src/operations/**", "src/features/**", "src/libs/**"],
      exclude: ["src/**/*.stories.tsx", "src/libs/ui/components/**"],
      thresholds: Object.fromEntries(floors),
    },
  },
});
