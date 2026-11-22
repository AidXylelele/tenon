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

const FEATURE_FLOOR = {
  lines: 85,
  branches: 85,
  functions: 85,
  statements: 85,
};

const FEATURES_DELETED_IN_M5 = [
  "code-editor",
  "step-inspector",
  "workflow-canvas",
];

const FEATURES_WAITING_FOR_TESTS = [
  "draft-conflict",
  "new-password-field",
  "problems",
  "run-status",
  "viewer-notice",
];

const FEATURES_BELOW_THE_FLOOR = FEATURES_DELETED_IN_M5.concat(
  FEATURES_WAITING_FOR_TESTS,
);

type Floor = typeof OPERATION_FLOOR;

function floorsOf(
  layer: string,
  floor: Floor,
  exempt: readonly string[],
): [string, Floor][] {
  const folder = new URL(`./src/${layer}/`, import.meta.url);

  return readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !exempt.includes(entry.name))
    .map((entry): [string, Floor] => [`src/${layer}/${entry.name}/**`, floor]);
}

const operationFloors = floorsOf("operations", OPERATION_FLOOR, []);

const featureFloors = floorsOf(
  "features",
  FEATURE_FLOOR,
  FEATURES_BELOW_THE_FLOOR,
);

const libFloors: [string, Floor][] = [
  ["src/libs/code-formatting/**", LIB_FLOOR],
  ["src/libs/codemirror/**", LIB_FLOOR],
  ["src/libs/ui/components/**", LIB_FLOOR],
  ["src/libs/ui/components/dialog.tsx", LIB_FLOOR],
  ["src/libs/ui/components/dropdown-menu.tsx", LIB_FLOOR],
  ["src/libs/ui/components/field.tsx", LIB_FLOOR],
  ["src/libs/ui/components/input-group.tsx", LIB_FLOOR],
  ["src/libs/ui/components/sidebar.tsx", LIB_FLOOR],
  ["src/libs/ui/components/toggle-group.tsx", LIB_FLOOR],
  ["src/libs/ui/composites/**", LIB_FLOOR],
  ["src/libs/ui/hooks/**", LIB_FLOOR],
  ["src/libs/ui/tokens/**", LIB_FLOOR],
];

const floors = operationFloors.concat(libFloors, featureFloors);

const thresholds = Object.fromEntries(floors);

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    server: {
      deps: {
        inline: ["@astral-sh/ruff-wasm-web"],
      },
    },
    coverage: {
      provider: "v8",
      include: ["src/{operations,features,libs}/**/*.{ts,tsx}"],
      exclude: ["src/**/*.stories.tsx", "src/**/*.test-support.ts"],
      thresholds,
    },
  },
});
