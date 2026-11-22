import { Module } from "@nestjs/common";
import { getDrizzleToken } from "@nestjs/drizzle";
import { OutboxStorage } from "@nestjs/outbox";
import {
  fromDrizzle as outboxExecutorOf,
  PostgresOutboxStore,
} from "@nestjs/outbox/postgres";
import { WorkflowStorage } from "@nestjs/workflows";
import {
  fromDrizzle as engineExecutorOf,
  PostgresWorkflowStore,
} from "@nestjs/workflows/postgres";
import type { Database } from "../../interface-adapters/persistence/interfaces.js";

@Module({
  providers: [
    {
      provide: PostgresOutboxStore,
      inject: [getDrizzleToken(), OutboxStorage],
      useFactory: (db: Database, storage: OutboxStorage) =>
        new PostgresOutboxStore({ executor: outboxExecutorOf(db) }, storage),
    },
    {
      provide: PostgresWorkflowStore,
      inject: [getDrizzleToken(), WorkflowStorage],
      useFactory: (db: Database, storage: WorkflowStorage) =>
        new PostgresWorkflowStore({ executor: engineExecutorOf(db) }, storage),
    },
  ],
})
export class DurableStoresModule {}
