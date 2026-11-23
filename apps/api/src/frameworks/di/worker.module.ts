import { Module } from "@nestjs/common";
import { ConfigModule, type ConfigType } from "@nestjs/config";
import { OutboxModule } from "@nestjs/outbox";
import { AesGcmPayloadCodec, WorkflowsModule } from "@nestjs/workflows";
import { PiscinaInterpreterClient } from "../interpreter/piscina-interpreter.client.js";
import { AutomationBackgroundModule } from "./automation-background.module.js";
import { engineConfig } from "./configs.js";
import { CoreModule } from "./core.module.js";
import { DurableStoresModule } from "./durable-stores.module.js";
import { workflowRetry } from "./host.presets.js";
import { IdentityBackgroundModule } from "./identity-background.module.js";
import { PayloadCodecModule } from "./payload-codec.module.js";
import { TelemetryModule } from "./telemetry.module.js";

@Module({
  imports: [
    TelemetryModule,
    CoreModule,
    WorkflowsModule.forRootAsync({
      imports: [PayloadCodecModule, ConfigModule.forFeature(engineConfig)],
      inject: [AesGcmPayloadCodec, engineConfig.KEY],
      useFactory: (
        codec: AesGcmPayloadCodec,
        engine: ConfigType<typeof engineConfig>,
      ) => ({
        retry: workflowRetry,
        codec,
        worker: {
          concurrency: PiscinaInterpreterClient.RUN_THREADS,
          pollInterval: "100ms",
          leaseDuration: `${engine.ENGINE_LEASE_SECONDS}s` as const,
          shutdownTimeout: "90s",
        },
      }),
    }),
    OutboxModule.forRoot({
      relay: { lease: "120s", publishTimeout: "60s" },
    }),
    DurableStoresModule,
    IdentityBackgroundModule,
    AutomationBackgroundModule,
  ],
})
export class WorkerModule {}
