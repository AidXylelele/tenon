import { readFileSync } from "node:fs";
import { z } from "zod";

const SECRET_FILES = [
  "DATABASE_URL",
  "SECRETS_KEY",
  "SANDBOX_TOKEN",
  "SMTP_PASSWORD",
] as const;

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

const role = z.enum(["on", "off"]).default("on");

const encryptionKey = z
  .base64()
  .refine((value) => Buffer.from(value, "base64").length === 32, {
    message: "SECRETS_KEY must be 32 bytes in base64",
  });

function withSecretFiles(
  input: unknown,
  context: z.core.$RefinementCtx,
): unknown {
  if (typeof input !== "object" || input === null) return input;

  const env = new Map<string, unknown>(Object.entries(input));

  for (const name of SECRET_FILES) {
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
      env.set(name, text.replace(TRAILING_LINE_BREAKS, ""));
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

const variables = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_SIZE: z.coerce.number().int().positive().default(20),
  WEB_BASE_URL: z.url(),
  ADMIN_EMAIL: z.string().trim().toLowerCase().pipe(z.email()),
  API_BASE_URL: z.url(),
  TRUSTED_ORIGINS: list,
  TRUSTED_PROXIES: list,
  SESSION_COOKIE_SECURE: z.stringbool().default(true),
  HTTP: role,
  ENGINE_WORKER: role,
  OUTBOX_RELAY: role,
  SECRETS_KEY: encryptionKey,
  OUTBOUND_ALLOW_LIST: allowedPrivateAddresses,
  SANDBOX_URL: z.url(),
  SANDBOX_TOKEN: z.string().min(32),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_STARTTLS: z
    .enum(["required", "opportunistic", "never"])
    .default("required"),
  SMTP_USER: optional,
  SMTP_PASSWORD: optional,
  SMTP_FROM: z.string().min(1),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
    .default("info"),
});

export const envSchema = z.preprocess(withSecretFiles, variables);

export type Env = z.infer<typeof envSchema>;

export const migrationEnvSchema = z.preprocess(
  withSecretFiles,
  variables.pick({ DATABASE_URL: true }).partial(),
);
