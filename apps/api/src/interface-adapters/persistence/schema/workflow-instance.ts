import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  CancelReason,
  Phase,
  TriggerKind,
} from "../../../domain/automation/instances/enums.js";
import type { RunWait } from "../../../domain/automation/instances/interfaces.js";
import type {
  JsonObject,
  JsonValue,
} from "../../../domain/automation/interfaces.js";
import { workflow } from "./workflow.js";
import { workflowVersion } from "./workflow-version.js";

export const workflowInstance = pgTable(
  "workflow_instance",
  {
    id: uuid("id").primaryKey(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflow.id),
    versionId: uuid("version_id")
      .notNull()
      .references(() => workflowVersion.id),
    trigger: text("trigger").$type<TriggerKind>().notNull(),
    starterId: uuid("starter_id"),
    originId: uuid("origin_id"),
    originEffectId: text("origin_effect_id"),
    input: jsonb("input").$type<JsonValue>(),
    phase: text("phase").$type<Phase>().notNull(),
    output: jsonb("output").$type<JsonValue>(),
    error: jsonb("error").$type<JsonObject>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    runState: text("run_state"),
    runFormat: integer("run_format"),
    programFingerprint: text("program_fingerprint"),
    runWaits: jsonb("run_waits")
      .$type<readonly RunWait[]>()
      .notNull()
      .default([]),
    cancelReason: text("cancel_reason").$type<CancelReason>(),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    index("workflow_instance_created_idx").on(table.createdAt, table.id),
    index("workflow_instance_workflow_idx").on(
      table.workflowId,
      table.createdAt,
      table.id,
    ),
    index("workflow_instance_origin_idx").on(
      table.originId,
      table.originEffectId,
    ),
  ],
);
