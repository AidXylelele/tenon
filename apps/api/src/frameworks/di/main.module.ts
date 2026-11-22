import { Module } from "@nestjs/common";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { sdk } from "../instrumentation.js";
import { OpenTelemetryShutdown } from "../opentelemetry/open-telemetry.shutdown.js";
import { AppModule } from "./app.module.js";

@Module({
  imports: [AppModule],
  providers: [{ provide: NodeSDK, useValue: sdk }, OpenTelemetryShutdown],
})
export class MainModule {}
