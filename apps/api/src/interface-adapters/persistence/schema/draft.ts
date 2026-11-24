import {
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { JsonObject } from "../../../domain/automation/interfaces.js";
import { user } from "./user.js";

export const draft = pgTable(
  "draft",
  {
    namespace: text("namespace").notNull(),
    name: text("name").notNull(),
    source: text("source").notNull(),
    layout: jsonb("layout").$type<JsonObject>().notNull(),
    revision: text("revision").notNull(),
    savedBy: uuid("saved_by")
      .notNull()
      .references(() => user.id),
    savedByName: text("saved_by_name").notNull(),
    savedAt: timestamp("saved_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.namespace, table.name] })],
);
