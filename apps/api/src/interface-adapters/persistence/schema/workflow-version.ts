import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { JsonObject } from "../../../domain/automation/interfaces.js";
import type {
  ImportTexts,
  Schedule,
} from "../../../domain/automation/workflows/interfaces.js";
import { user } from "./user.js";
import { workflow } from "./workflow.js";

export const workflowVersion = pgTable(
  "workflow_version",
  {
    id: uuid("id").primaryKey(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflow.id),
    semver: text("semver").notNull(),
    dsl: text("dsl").notNull(),
    document: jsonb("document").$type<JsonObject>().notNull(),
    imports: jsonb("imports").$type<ImportTexts>().notNull().default({}),
    digest: text("digest").notNull(),
    programFingerprint: text("program_fingerprint").notNull(),
    schedule: jsonb("schedule").$type<Schedule>(),
    secrets: text("secrets").array().notNull(),
    source: text("source"),
    publisherId: uuid("publisher_id")
      .notNull()
      .references(() => user.id),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("workflow_version_workflow_semver_idx").on(
      table.workflowId,
      table.semver,
    ),
  ],
);
