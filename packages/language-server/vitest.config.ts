import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const browserEntryUrl = new URL(
  "./node_modules/vscode-languageserver/lib/browser/main.js",
  import.meta.url,
);
const browserEntry = fileURLToPath(browserEntryUrl);

export default defineConfig({
  resolve: {
    alias: [
      { find: /^vscode-languageserver\/browser$/, replacement: browserEntry },
    ],
  },
  test: {
    include: ["tests/**/*.test.ts"],
    execArgv: ["--import", "./tests/support/browser-conditions.ts"],
  },
});
