import { defineConfig, devices } from "@playwright/test";

const PLAYGROUND_URL = "http://localhost:6007";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: true,
  reporter: "list",
  projects: [
    {
      name: "playground",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: PLAYGROUND_URL,
        reducedMotion: "reduce",
      },
    },
  ],
  webServer: {
    command:
      "vite preview --config e2e/playground-server.config.ts --outDir storybook-static --port 6007 --strictPort",
    url: PLAYGROUND_URL,
  },
});
