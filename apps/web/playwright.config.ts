import { defineConfig, devices } from "@playwright/test";
import { PLAYGROUND_PORT } from "./e2e/playground-port";

const PLAYGROUND_URL = `http://localhost:${String(PLAYGROUND_PORT)}`;

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "production/**",
  fullyParallel: true,
  forbidOnly: true,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: PLAYGROUND_URL,
    reducedMotion: "reduce",
  },
  webServer: {
    command:
      "vite preview --config e2e/playground-server.config.ts --outDir storybook-static",
    url: PLAYGROUND_URL,
  },
});
