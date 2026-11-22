import {
  bigserial,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { EventOrigin } from "../../../application/automation/events/enums.js";
import type { JsonObject } from "../../../domain/automation/interfaces.js";
import type { LifecycleEventName } from "../interfaces.js";

export const event = pgTable(
  "event",
  {
    sequence: bigserial("sequence", { mode: "number" }).primaryKey(),
    source: text("source").notNull(),
    eventId: text("event_id").notNull(),
    type: text("type").notNull(),
    origin: text("origin").$type<EventOrigin>().notNull(),
    instanceId: uuid("instance_id"),
    execution: text("execution"),
    lifecycle: text("lifecycle").$type<LifecycleEventName>(),
    cloudEvent: jsonb("cloud_event").$type<JsonObject>().notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("event_source_id_idx").on(table.source, table.eventId),
    index("event_instance_idx").on(table.instanceId, table.sequence),
  ],
);
