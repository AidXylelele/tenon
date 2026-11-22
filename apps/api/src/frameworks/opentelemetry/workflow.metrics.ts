import {
  Injectable,
  type OnApplicationShutdown,
  type OnModuleInit,
} from "@nestjs/common";
import {
  type WorkflowCompensationFailedEvent,
  type WorkflowEvent,
  WorkflowEvents,
  type WorkflowStepCompletedEvent,
} from "@nestjs/workflows";
import { type Counter, type Histogram, metrics } from "@opentelemetry/api";
import { Subscription } from "rxjs";
import { Instrumentation } from "./enums.js";
import { StepName } from "../../interface-adapters/workflows/runners/step-name.js";
import { durationBoundaries } from "./histogram.presets.js";

@Injectable()
export class WorkflowMetrics implements OnModuleInit, OnApplicationShutdown {
  readonly #subscription = new Subscription();
  readonly #executions: Counter;
  readonly #stepDuration: Histogram;
  readonly #compensationFailures: Counter;

  constructor(private readonly events: WorkflowEvents) {
    const meter = metrics.getMeter(Instrumentation.Scope);
    this.#executions = meter.createCounter("tenon.workflow.executions", {
      unit: "{execution}",
      description: "The executions of workflow instances that began.",
    });
    this.#stepDuration = meter.createHistogram("tenon.workflow.step.duration", {
      unit: "s",
      description: "The time a completed step attempt took.",
      advice: { explicitBucketBoundaries: durationBoundaries },
    });
    this.#compensationFailures = meter.createCounter(
      "tenon.workflow.compensation.failures",
      {
        unit: "{failure}",
        description: "The compensations that gave up halfway.",
      },
    );
  }

  onModuleInit(): void {
    const recording = this.events.events$.subscribe((event) => {
      this.#recorded(event);
    });
    this.#subscription.add(recording);
  }

  onApplicationShutdown(): void {
    this.#subscription.unsubscribe();
  }

  #recorded(event: WorkflowEvent): void {
    switch (event.type) {
      case "workflow-started":
        return this.#executed(event, "started");
      case "workflow-resumed":
        return this.#executed(event, "resumed");
      case "step-completed":
        return this.#stepped(event);
      case "workflow-compensation-failed":
        return this.#uncompensated(event);
      default:
        return;
    }
  }

  #executed(event: WorkflowEvent, kind: string): void {
    const attributes = {
      "tenon.workflow": event.workflow,
      "tenon.execution.kind": kind,
    };
    this.#executions.add(1, attributes);
  }

  #stepped(event: WorkflowStepCompletedEvent): void {
    const step = new StepName(event.step);
    const attributes = {
      "tenon.workflow": event.workflow,
      "tenon.step.kind": step.kind(),
    };
    const seconds = event.durationMs / 1000;
    this.#stepDuration.record(seconds, attributes);
  }

  #uncompensated(event: WorkflowCompensationFailedEvent): void {
    const attributes = { "tenon.workflow": event.workflow };
    this.#compensationFailures.add(1, attributes);
  }
}
