import { Module } from "@nestjs/common";
import { OutboxModule } from "@nestjs/outbox";
import { AesGcmPayloadCodec, WorkflowsModule } from "@nestjs/workflows";
import { AutomationHttpModule } from "./automation-http.module.js";
import { CoreModule } from "./core.module.js";
import { DurableStoresModule } from "./durable-stores.module.js";
import { workflowRetry } from "./host.presets.js";
import { HttpModule } from "./http.module.js";
import { IdentityHttpModule } from "./identity-http.module.js";
import { PayloadCodecModule } from "./payload-codec.module.js";
import { TelemetryModule } from "./telemetry.module.js";

@Module({
  imports: [
    TelemetryModule,
    CoreModule,
    WorkflowsModule.forRootAsync({
      imports: [PayloadCodecModule],
      inject: [AesGcmPayloadCodec],
      useFactory: (codec: AesGcmPayloadCodec) => ({
        retry: workflowRetry,
        codec,
        worker: false,
      }),
    }),
    OutboxModule.forRoot({ relay: { enabled: false } }),
    DurableStoresModule,
    HttpModule,
    IdentityHttpModule,
    AutomationHttpModule,
  ],
})
export class ApiModule {}
