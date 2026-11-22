import { Module } from "@nestjs/common";
import { getDrizzleToken } from "@nestjs/drizzle";
import { OutboxModule, OutboxStorage } from "@nestjs/outbox";
import {
  fromDrizzle as outboxExecutorOf,
  PostgresOutboxStore,
} from "@nestjs/outbox/postgres";
import {
  AesGcmPayloadCodec,
  WorkflowsModule,
  WorkflowStorage,
} from "@nestjs/workflows";
import {
  fromDrizzle as engineExecutorOf,
  PostgresWorkflowStore,
} from "@nestjs/workflows/postgres";
import type { Database } from "../../interface-adapters/persistence/interfaces.js";
import { WorkerInterpreterClient } from "../interpreter/worker-interpreter.client.js";
import { AutomationBackgroundModule } from "./automation-background.module.js";
import { CoreModule } from "./core.module.js";
import { IdentityBackgroundModule } from "./identity-background.module.js";
import { workflowRetry } from "./resilience.presets.js";

@Module({
  imports: [
    CoreModule,
    WorkflowsModule.forRootAsync({
      imports: [CoreModule],
      inject: [AesGcmPayloadCodec],
      useFactory: (codec: AesGcmPayloadCodec) => ({
        retry: workflowRetry,
        codec,
        worker: {
          concurrency: WorkerInterpreterClient.RUN_THREADS,
          pollInterval: "100ms",
          leaseDuration: "120s",
          shutdownTimeout: "90s",
        },
      }),
    }),
    OutboxModule.forRoot({
      relay: { lease: "120s", publishTimeout: "60s" },
    }),
    IdentityBackgroundModule,
    AutomationBackgroundModule,
  ],
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
export class WorkerModule {}
