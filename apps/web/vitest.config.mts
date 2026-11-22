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

const EDITOR_FLOOR = {
  lines: 85,
  branches: 85,
  functions: 85,
  statements: 85,
};

type Floor = typeof OPERATION_FLOOR;

const operations = new URL("./src/operations/", import.meta.url);

const operationFloors = readdirSync(operations, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry): [string, Floor] => [
    `src/operations/${entry.name}/**`,
    OPERATION_FLOOR,
  ]);

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

const EDITOR = "src/spaces/workflows/modules/workflow-editor";

const EDITOR_PARTS = ["step-form", "form-fields", "data-picker"];

const editorFloors = EDITOR_PARTS.map((part): [string, Floor] => [
  `${EDITOR}/${part}/**`,
  EDITOR_FLOOR,
]);

const editorCovered = EDITOR_PARTS.map(
  (part) => `${EDITOR}/${part}/**/*.{ts,tsx}`,
);

const floors = operationFloors.concat(libFloors, editorFloors);

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
      include: ["src/{operations,features,libs}/**/*.{ts,tsx}"].concat(
        editorCovered,
      ),
      exclude: ["src/**/*.stories.tsx", "src/**/*.test-support.ts"],
      thresholds,
    },
  },
});
