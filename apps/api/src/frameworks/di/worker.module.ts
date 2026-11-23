import { Module } from "@nestjs/common";
import { ConfigModule, type ConfigType } from "@nestjs/config";
import { OutboxModule } from "@nestjs/outbox";
import { AutomationBackgroundModule } from "./automation-background.module.js";
import { outboxConfig } from "./configs.js";
import { CoreModule } from "./core.module.js";
import { relayRetry } from "./host.presets.js";
import { IdentityBackgroundModule } from "./identity-background.module.js";
import { OutboxStoreModule } from "./outbox-store.module.js";
import { TelemetryModule } from "./telemetry.module.js";

@Module({
  imports: [
    TelemetryModule,
    CoreModule,
    OutboxModule.forRootAsync({
      imports: [ConfigModule.forFeature(outboxConfig)],
      inject: [outboxConfig.KEY],
      useFactory: (outbox: ConfigType<typeof outboxConfig>) => ({
        relay: {
          pollInterval: outbox.OUTBOX_POLL_INTERVAL_MS,
          lease: "180s",
          publishTimeout: "60s",
          batchSize: 100,
          concurrency: outbox.OUTBOX_CONCURRENCY,
        },
        retry: relayRetry,
      }),
    }),
    OutboxStoreModule,
    IdentityBackgroundModule,
    AutomationBackgroundModule,
  ],
})
export class WorkerModule {}
