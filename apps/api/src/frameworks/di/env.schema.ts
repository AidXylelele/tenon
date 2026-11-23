import { readFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { z } from "zod";

const TRAILING_LINE_BREAKS = /[\r\n]+$/;

const list = z
  .string()
  .default("")
  .transform((value) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );

const allowedPrivateAddresses = list.pipe(
  z.array(z.union([z.ipv4(), z.ipv6(), z.cidrv4(), z.cidrv6()])),
);

const optional = z.string().default("");

const encryptionKey = z.base64().refine(
  (value) => {
    const key = Buffer.from(value, "base64");
    return key.length === 32;
  },
  { message: "SECRETS_KEY must be 32 bytes in base64" },
);

function withSecretFiles(
  input: unknown,
  context: z.core.$RefinementCtx,
  secrets: readonly string[],
): unknown {
  if (typeof input !== "object" || input === null) return input;

  const entries = Object.entries(input);
  const env = new Map<string, unknown>(entries);

  for (const name of secrets) {
    const variable = `${name}_FILE`;
    const file = env.get(variable);

    if (typeof file !== "string" || file === "") continue;

    const value = env.get(name);

    if (value !== undefined && value !== "") {
      context.addIssue({
        code: "custom",
        path: [variable],
        message: `is set together with ${name}; set one of them`,
      });
      continue;
    }

    try {
      const text = readFileSync(file, "utf8");
      const trimmed = text.replace(TRAILING_LINE_BREAKS, "");
      env.set(name, trimmed);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      context.addIssue({
        code: "custom",
        path: [variable],
        message: `cannot be read: ${reason}`,
      });
    }
  }

  return Object.fromEntries(env);
}

const databaseVariables = z.object({
  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_SIZE: z.coerce.number().int().positive().default(20),
  DATABASE_POOL_MIN: z.coerce.number().int().nonnegative().default(5),
});

export const loggingEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
    .default("info"),
});

export const databaseEnvSchema = z.preprocess(
  (input, context) => withSecretFiles(input, context, ["DATABASE_URL"]),
  databaseVariables.refine(
    (database) => database.DATABASE_POOL_MIN <= database.DATABASE_POOL_SIZE,
    {
      path: ["DATABASE_POOL_MIN"],
      message: "must not exceed DATABASE_POOL_SIZE",
    },
  ),
);

export const secretsEnvSchema = z.preprocess(
  (input, context) => withSecretFiles(input, context, ["SECRETS_KEY"]),
  z.object({ SECRETS_KEY: encryptionKey }),
);

export const linksEnvSchema = z.object({
  WEB_BASE_URL: z.url(),
  API_BASE_URL: z.url(),
});

export const httpEnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  TRUSTED_ORIGINS: list,
  TRUSTED_PROXIES: list,
  SESSION_COOKIE_SECURE: z.stringbool().default(true),
});

export const outboundEnvSchema = z.object({
  OUTBOUND_ALLOW_LIST: allowedPrivateAddresses,
});

export const outboxEnvSchema = z.object({
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(100),
  OUTBOX_CONCURRENCY: z.coerce.number().int().positive().default(32),
});

export const interpreterEnvSchema = z.object({
  LEGACY_EVENT_TYPES: z.stringbool().default(false),
  INTERPRETER_RUN_THREADS: z
    .literal("")
    .transform(() => availableParallelism())
    .or(z.coerce.number().int().positive())
    .default(availableParallelism()),
  INTERPRETER_CHECK_THREADS: z.coerce.number().int().positive().default(1),
});

export const sandboxEnvSchema = z.preprocess(
  (input, context) => withSecretFiles(input, context, ["SANDBOX_TOKEN"]),
  z.object({
    SANDBOX_URL: z.url(),
    SANDBOX_TOKEN: z.string().min(32),
  }),
);

export const mailEnvSchema = z.preprocess(
  (input, context) => withSecretFiles(input, context, ["SMTP_PASSWORD"]),
  z.object({
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.coerce.number().int().positive(),
    SMTP_STARTTLS: z
      .enum(["required", "opportunistic", "never"])
      .default("required"),
    SMTP_USER: optional,
    SMTP_PASSWORD: optional,
    SMTP_FROM: z.string().min(1),
  }),
);

export const migrationEnvSchema = z.preprocess(
  (input, context) => withSecretFiles(input, context, ["DATABASE_URL"]),
  databaseVariables.pick({ DATABASE_URL: true }).partial(),
);
