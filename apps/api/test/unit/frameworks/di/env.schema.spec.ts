import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  databaseEnvSchema,
  engineEnvSchema,
  interpreterEnvSchema,
  mailEnvSchema,
  migrationEnvSchema,
} from "../../../../src/frameworks/di/env.schema.js";

const mail: Readonly<Record<string, string>> = {
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
    const database = databaseEnvSchema.parse({
      DATABASE_URL_FILE: databaseFile,
    });
    const smtp = mailEnvSchema.parse({
      ...mail,
      SMTP_PASSWORD: "",
      SMTP_PASSWORD_FILE: passwordFile,
    });

    expect(database.DATABASE_URL).toBe("postgres://db.internal/tenon");
    expect(smtp.SMTP_PASSWORD).toBe("mail-password");
  });

  it("a_secret_set_directly_needs_no_file", () => {
    const parsed = databaseEnvSchema.parse({
      DATABASE_URL: "postgres://localhost/tenon",
    });

    expect(parsed.DATABASE_URL).toBe("postgres://localhost/tenon");
  });

  it("a_secret_set_both_ways_is_refused", () => {
    const parsed = databaseEnvSchema.safeParse({
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
    const parsed = databaseEnvSchema.safeParse({
      DATABASE_URL_FILE: join(directory, "missing"),
    });

    expect(parsed.error?.issues[0]).toMatchObject({
      path: ["DATABASE_URL_FILE"],
      message: expect.stringMatching(/^cannot be read: ENOENT/) as unknown,
    });
  });

  it("a_namespace_reads_only_its_own_secret_files", () => {
    const missing = join(directory, "missing");
    const parsed = databaseEnvSchema.safeParse({
      DATABASE_URL: "postgres://localhost/tenon",
      SMTP_PASSWORD_FILE: missing,
    });

    expect(parsed.success).toBe(true);
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

describe("the interpreter's environment", () => {
  it("the_legacy_event_types_are_off_by_default", () => {
    const parsed = interpreterEnvSchema.parse({});

    expect(parsed.LEGACY_EVENT_TYPES).toBe(false);
  });

  it("the_legacy_event_types_are_on_when_set_to_true", () => {
    const parsed = interpreterEnvSchema.parse({ LEGACY_EVENT_TYPES: "true" });

    expect(parsed.LEGACY_EVENT_TYPES).toBe(true);
  });

  it("a_legacy_event_types_value_that_is_no_boolean_is_refused", () => {
    const parsed = interpreterEnvSchema.safeParse({
      LEGACY_EVENT_TYPES: "sometimes",
    });

    expect(parsed.error?.issues[0]?.path).toEqual(["LEGACY_EVENT_TYPES"]);
  });
});

describe("the database pool's environment", () => {
  const url = "postgres://localhost/tenon";

  it("the_pool_keeps_five_connections_open_by_default", () => {
    const parsed = databaseEnvSchema.parse({ DATABASE_URL: url });

    expect(parsed.DATABASE_POOL_MIN).toBe(5);
  });

  it("the_pool_keeps_as_many_connections_open_as_set", () => {
    const parsed = databaseEnvSchema.parse({
      DATABASE_URL: url,
      DATABASE_POOL_MIN: "0",
    });

    expect(parsed.DATABASE_POOL_MIN).toBe(0);
  });

  it("a_pool_minimum_above_its_size_is_refused", () => {
    const parsed = databaseEnvSchema.safeParse({
      DATABASE_URL: url,
      DATABASE_POOL_SIZE: "4",
      DATABASE_POOL_MIN: "5",
    });

    expect(parsed.error?.issues[0]).toMatchObject({
      path: ["DATABASE_POOL_MIN"],
      message: "must not exceed DATABASE_POOL_SIZE",
    });
  });
});

describe("the engine's environment", () => {
  it("a_run_holds_its_lease_for_thirty_seconds_by_default", () => {
    const parsed = engineEnvSchema.parse({});

    expect(parsed.ENGINE_LEASE_SECONDS).toBe(30);
  });

  it("a_run_holds_its_lease_as_long_as_set", () => {
    const parsed = engineEnvSchema.parse({ ENGINE_LEASE_SECONDS: "120" });

    expect(parsed.ENGINE_LEASE_SECONDS).toBe(120);
  });

  it("a_lease_that_is_no_positive_number_of_seconds_is_refused", () => {
    const parsed = engineEnvSchema.safeParse({ ENGINE_LEASE_SECONDS: "0" });

    expect(parsed.error?.issues[0]?.path).toEqual(["ENGINE_LEASE_SECONDS"]);
  });
});
