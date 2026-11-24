import {
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { TaskValueKind } from "../../../domain/automation/instances/enums.js";
import { workflowInstance } from "./workflow-instance.js";

export const taskValue = pgTable(
  "task_value",
  {
    instanceId: uuid("instance_id")
      .notNull()
      .references(() => workflowInstance.id, { onDelete: "cascade" }),
    execution: text("execution").notNull(),
    kind: text("kind").$type<TaskValueKind>().notNull(),
    sealedValue: text("sealed_value").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.instanceId, table.execution, table.kind] }),
  ],
);
