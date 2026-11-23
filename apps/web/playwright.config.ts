import { defineConfig, devices } from "@playwright/test";
import { PLAYGROUND_PORT } from "./e2e/playground-port";
import { API_STUB_PORT, CONSOLE_PORT } from "./e2e/production/ports";

const PLAYGROUND_URL = `http://localhost:${String(PLAYGROUND_PORT)}`;

const CONSOLE_URL = `http://localhost:${String(CONSOLE_PORT)}`;

const API_STUB_URL = `http://localhost:${String(API_STUB_PORT)}`;

const BUILD_MS = 600_000;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: true,
  reporter: "list",
  projects: [
    {
      name: "playground",
      testIgnore: "production/**",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: PLAYGROUND_URL,
        reducedMotion: "reduce",
      },
    },
    {
      name: "production",
      testDir: "./e2e/production",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: CONSOLE_URL,
        reducedMotion: "reduce",
      },
    },
  ],
  webServer: [
    {
      command:
        "vite preview --config e2e/playground-server.config.ts --outDir storybook-static",
      url: PLAYGROUND_URL,
    },
    {
      command: "node e2e/production/api-stub.mjs",
      url: `${API_STUB_URL}/api/v1/health/ready`,
      env: { API_STUB_PORT: String(API_STUB_PORT) },
    },
    {
      command: "next build && pnpm start",
      url: `${CONSOLE_URL}/sign-in`,
      timeout: BUILD_MS,
      env: {
        PORT: String(CONSOLE_PORT),
        API_URL: API_STUB_URL,
        SESSION_COOKIE_SECURE: "false",
      },
    },
  ],
});
