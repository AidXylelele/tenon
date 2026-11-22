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
import { AutomationHttpModule } from "./automation-http.module.js";
import { CoreModule } from "./core.module.js";
import { HttpModule } from "./http.module.js";
import { IdentityHttpModule } from "./identity-http.module.js";
import { workflowRetry } from "./resilience.presets.js";
import { TelemetryModule } from "./telemetry.module.js";

@Module({
  imports: [
    TelemetryModule,
    CoreModule,
    WorkflowsModule.forRootAsync({
      imports: [CoreModule],
      inject: [AesGcmPayloadCodec],
      useFactory: (codec: AesGcmPayloadCodec) => ({
        retry: workflowRetry,
        codec,
        worker: false,
      }),
    }),
    OutboxModule.forRoot({ relay: { enabled: false } }),
    HttpModule,
    IdentityHttpModule,
    AutomationHttpModule,
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
export class ApiModule {}
