import { defineConfig } from "drizzle-kit";
import { migrationEnvSchema } from "./src/frameworks/di/env.schema.js";

const env = migrationEnvSchema.parse(process.env);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/interface-adapters/persistence/schema/index.ts",
  out: "./drizzle",
  casing: "snake_case",
  dbCredentials: { url: env.DATABASE_URL ?? "" },
});
