import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  envSchema,
  migrationEnvSchema,
} from "../../../src/frameworks/di/env.schema.js";

const environment: Readonly<Record<string, string>> = {
  WEB_BASE_URL: "http://127.0.0.1:3001",
  ADMIN_EMAIL: "admin@example.com",
  API_BASE_URL: "http://127.0.0.1:3000",
  SECRETS_KEY: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
  SANDBOX_URL: "http://127.0.0.1:55050",
  SANDBOX_TOKEN: "sandbox-token-of-at-least-32-characters",
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: "2525",
  SMTP_FROM: "Tenon <no-reply@test.local>",
};

describe("the environment, with Docker's _FILE secrets", () => {
  const directory = mkdtempSync(join(tmpdir(), "tenon-env-"));
  const databaseFile = join(directory, "database-url");
  const passwordFile = join(directory, "smtp-password");
  writeFileSync(databaseFile, "postgres://db.internal/tenon\n");
  writeFileSync(passwordFile, "mail-password");

  afterAll(() => {
    rmSync(directory, { recursive: true });
  });

  it("a_secret_is_read_from_its_file_without_the_trailing_line_break", () => {
    const parsed = envSchema.parse({
      ...environment,
      DATABASE_URL_FILE: databaseFile,
      SMTP_PASSWORD: "",
      SMTP_PASSWORD_FILE: passwordFile,
    });

    expect(parsed.DATABASE_URL).toBe("postgres://db.internal/tenon");
    expect(parsed.SMTP_PASSWORD).toBe("mail-password");
  });

  it("a_secret_set_directly_needs_no_file", () => {
    const parsed = envSchema.parse({
      ...environment,
      DATABASE_URL: "postgres://localhost/tenon",
    });

    expect(parsed.DATABASE_URL).toBe("postgres://localhost/tenon");
  });

  it("a_secret_set_both_ways_is_refused", () => {
    const parsed = envSchema.safeParse({
      ...environment,
      DATABASE_URL: "postgres://localhost/tenon",
      DATABASE_URL_FILE: databaseFile,
    });

    expect(parsed.error?.issues).toMatchObject([
      {
        path: ["DATABASE_URL_FILE"],
        message: "is set together with DATABASE_URL; set one of them",
      },
    ]);
  });

  it("a_secret_file_that_cannot_be_read_is_refused_and_names_its_variable", () => {
    const parsed = envSchema.safeParse({
      ...environment,
      DATABASE_URL_FILE: join(directory, "missing"),
    });

    expect(parsed.error?.issues[0]).toMatchObject({
      path: ["DATABASE_URL_FILE"],
      message: expect.stringMatching(/^cannot be read: ENOENT/) as unknown,
    });
  });

  it("the_migration_reads_the_database_url_by_the_same_rule", () => {
    const parsed = migrationEnvSchema.parse({
      DATABASE_URL_FILE: databaseFile,
    });

    expect(parsed.DATABASE_URL).toBe("postgres://db.internal/tenon");
  });

  it("the_migration_needs_no_database_url_to_generate", () => {
    const parsed = migrationEnvSchema.parse({});

    expect(parsed.DATABASE_URL).toBeUndefined();
  });
});

describe("the first administrator's address", () => {
  it("is_trimmed_and_in_lower_case", () => {
    const parsed = envSchema.parse({
      ...environment,
      DATABASE_URL: "postgres://localhost/tenon",
      ADMIN_EMAIL: " Owner@Example.COM ",
    });

    expect(parsed.ADMIN_EMAIL).toBe("owner@example.com");
  });

  it("is_refused_when_it_is_not_an_email", () => {
    const parsed = envSchema.safeParse({
      ...environment,
      DATABASE_URL: "postgres://localhost/tenon",
      ADMIN_EMAIL: "owner at example",
    });

    expect(parsed.error?.issues[0]?.path).toEqual(["ADMIN_EMAIL"]);
  });
});
