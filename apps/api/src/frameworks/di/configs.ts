import { registerAs } from "@nestjs/config";
import {
  databaseEnvSchema,
  httpEnvSchema,
  interpreterEnvSchema,
  linksEnvSchema,
  loggingEnvSchema,
  mailEnvSchema,
  outboundEnvSchema,
  sandboxEnvSchema,
  secretsEnvSchema,
} from "./env.schema.js";

export const loggingConfig = registerAs("logging", () =>
  loggingEnvSchema.parse(process.env),
);

export const databaseConfig = registerAs("database", () =>
  databaseEnvSchema.parse(process.env),
);

export const secretsConfig = registerAs("secrets", () =>
  secretsEnvSchema.parse(process.env),
);

export const linksConfig = registerAs("links", () =>
  linksEnvSchema.parse(process.env),
);

export const httpConfig = registerAs("http", () =>
  httpEnvSchema.parse(process.env),
);

export const outboundConfig = registerAs("outbound", () =>
  outboundEnvSchema.parse(process.env),
);

export const interpreterConfig = registerAs("interpreter", () =>
  interpreterEnvSchema.parse(process.env),
);

export const sandboxConfig = registerAs("sandbox", () =>
  sandboxEnvSchema.parse(process.env),
);

export const mailConfig = registerAs("mail", () =>
  mailEnvSchema.parse(process.env),
);
