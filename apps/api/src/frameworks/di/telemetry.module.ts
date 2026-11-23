import { Global, Module } from "@nestjs/common";
import { trace } from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { JobTracer } from "../../interface-adapters/jobs/job.tracer.js";
import { RunTracer } from "../../interface-adapters/workflows/runners/run.tracer.js";
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
      provide: RunTracer,
      useFactory: () => new RunTracer(trace.getTracer(Instrumentation.Scope)),
    },
    {
      provide: JobTracer,
      useFactory: () => new JobTracer(trace.getTracer(Instrumentation.Scope)),
    },
  ],
  exports: [RunTracer, JobTracer],
})
export class TelemetryModule {}
