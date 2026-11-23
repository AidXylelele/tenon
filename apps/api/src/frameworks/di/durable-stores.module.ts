import { Module } from "@nestjs/common";
import { getDrizzleToken } from "@nestjs/drizzle";
import { OutboxStorage } from "@nestjs/outbox";
import { fromDrizzle, PostgresOutboxStore } from "@nestjs/outbox/postgres";
import type { Database } from "../../interface-adapters/persistence/interfaces.js";

@Module({
  providers: [
    {
      provide: PostgresOutboxStore,
      inject: [getDrizzleToken(), OutboxStorage],
      useFactory: (db: Database, storage: OutboxStorage) =>
        new PostgresOutboxStore({ executor: fromDrizzle(db) }, storage),
    },
  ],
})
export class DurableStoresModule {}
