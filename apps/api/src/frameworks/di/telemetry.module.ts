import { Global, Module } from "@nestjs/common";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { sdk } from "../instrumentation.js";
import { LockMetrics } from "../opentelemetry/lock.metrics.js";
import { OpenTelemetryShutdown } from "../opentelemetry/opentelemetry.shutdown.js";
import { OutboxMetrics } from "../opentelemetry/outbox.metrics.js";
import { WorkflowMetrics } from "../opentelemetry/workflow.metrics.js";

@Global()
@Module({
  providers: [
    { provide: NodeSDK, useValue: sdk },
    OpenTelemetryShutdown,
    WorkflowMetrics,
    OutboxMetrics,
    LockMetrics,
  ],
})
export class TelemetryModule {}
