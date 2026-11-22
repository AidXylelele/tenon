import { Global, Module } from "@nestjs/common";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { JobTracer } from "../../interface-adapters/jobs/job.tracer.js";
import { OutboxTracer } from "../../interface-adapters/messaging/outbox.tracer.js";
import { RunTracer } from "../../interface-adapters/workflows/runners/run.tracer.js";
import { sdk } from "../instrumentation.js";
import { LockMetrics } from "../opentelemetry/lock.metrics.js";
import { OpenTelemetryShutdown } from "../opentelemetry/open-telemetry.shutdown.js";
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
    RunTracer,
    OutboxTracer,
    JobTracer,
  ],
  exports: [RunTracer, OutboxTracer, JobTracer],
})
export class TelemetryModule {}
