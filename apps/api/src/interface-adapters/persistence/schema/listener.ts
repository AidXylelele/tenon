import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { OpenFilter } from "../../../domain/automation/instances/interfaces.js";
import { workflowInstance } from "./workflow-instance.js";

export const listener = pgTable(
  "listener",
  {
    instanceId: uuid("instance_id")
      .notNull()
      .references(() => workflowInstance.id, { onDelete: "cascade" }),
    execution: text("execution").notNull(),
    effectId: text("effect_id").notNull(),
    stream: text("stream").notNull(),
    position: integer("position").notNull(),
    open: jsonb("open").$type<readonly OpenFilter[]>().notNull(),
    since: timestamp("since", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.instanceId, table.execution] }),
    index("listener_stream_idx").on(table.stream),
  ],
);
