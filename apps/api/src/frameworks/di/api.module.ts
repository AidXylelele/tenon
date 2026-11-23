import { Module } from "@nestjs/common";
import { OutboxModule } from "@nestjs/outbox";
import { AutomationHttpModule } from "./automation-http.module.js";
import { CoreModule } from "./core.module.js";
import { DurableStoresModule } from "./durable-stores.module.js";
import { HttpModule } from "./http.module.js";
import { IdentityHttpModule } from "./identity-http.module.js";
import { TelemetryModule } from "./telemetry.module.js";

@Module({
  imports: [
    TelemetryModule,
    CoreModule,
    OutboxModule.forRoot({ relay: { enabled: false } }),
    DurableStoresModule,
    HttpModule,
    IdentityHttpModule,
    AutomationHttpModule,
  ],
})
export class ApiModule {}
