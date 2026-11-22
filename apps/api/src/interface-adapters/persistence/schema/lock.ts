import {
  bigint,
  pgSequence,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const lock = pgTable("lock", {
  key: text("key").primaryKey(),
  owner: text("owner"),
  fencingToken: bigint("fencing_token", { mode: "number" }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const lockFencingToken = pgSequence("lock_fencing_token_seq");
