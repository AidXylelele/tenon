import { inject, vi } from "vitest";

vi.mock("../../src/frameworks/instrumentation.js", () => ({
  sdk: { shutdown: () => Promise.resolve() },
}));

Object.assign(process.env, {
  NODE_ENV: "test",
  PORT: "3000",
  DATABASE_URL: inject("DATABASE_URL"),
  WEB_BASE_URL: "http://127.0.0.1:3001",
  API_BASE_URL: "http://127.0.0.1:3000",
  TRUSTED_ORIGINS: "http://127.0.0.1:3001",
  TRUSTED_PROXIES: "127.0.0.1",
  SESSION_COOKIE_SECURE: "false",
  SECRETS_KEY: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
  OUTBOUND_ALLOW_LIST: "",
  SANDBOX_URL: "http://127.0.0.1:55050",
  SANDBOX_TOKEN: "test-sandbox-token-of-at-least-32-characters",
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: "2525",
  SMTP_STARTTLS: "never",
  SMTP_USER: "",
  SMTP_PASSWORD: "",
  SMTP_FROM: "Tenon <no-reply@test.local>",
  LOG_LEVEL: "silent",
});
