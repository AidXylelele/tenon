import { Global, Module } from "@nestjs/common";
import { trace } from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OutboxTracer } from "../../interface-adapters/messaging/outbox.tracer.js";
import { sdk } from "../instrumentation.js";
import { Instrumentation } from "../opentelemetry/enums.js";
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
    {
      provide: OutboxTracer,
      useFactory: () =>
        new OutboxTracer(trace.getTracer(Instrumentation.Scope)),
    },
  ],
  exports: [OutboxTracer],
})
export class TelemetryModule {}
