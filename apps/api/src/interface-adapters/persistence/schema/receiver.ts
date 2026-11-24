import {
  bigint,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { JsonObject } from "../../../domain/automation/interfaces.js";
import { workflowInstance } from "./workflow-instance.js";

export const receiver = pgTable(
  "receiver",
  {
    instanceId: uuid("instance_id")
      .notNull()
      .references(() => workflowInstance.id, { onDelete: "cascade" }),
    execution: text("execution").notNull(),
    request: jsonb("request").$type<JsonObject>().notNull(),
    closesAt: timestamp("closes_at", { withTimezone: true }),
    nextPosition: integer("next_position").notNull().default(0),
    awaiting: integer("awaiting"),
    fence: bigint("fence", { mode: "number" }).notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.instanceId, table.execution] })],
);

export const receivedMessage = pgTable(
  "received_message",
  {
    instanceId: uuid("instance_id").notNull(),
    execution: text("execution").notNull(),
    position: integer("position").notNull(),
    sealedInbound: text("sealed_inbound").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.instanceId, table.execution, table.position],
    }),
    foreignKey({
      columns: [table.instanceId, table.execution],
      foreignColumns: [receiver.instanceId, receiver.execution],
    }).onDelete("cascade"),
  ],
);
