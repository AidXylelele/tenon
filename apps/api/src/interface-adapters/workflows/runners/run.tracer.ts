import {
  isWorkflowInterrupt,
  type WorkflowContext,
  type WorkflowStepContext,
} from "@nestjs/workflows";
import {
  type Attributes,
  type Span,
  SpanKind,
  SpanStatusCode,
  type Tracer,
} from "@opentelemetry/api";
import { StepName } from "./step-name.js";

export class RunTracer {
  constructor(private readonly tracer: Tracer) {}

  execution<T>(
    ctx: WorkflowContext,
    work: () => Promise<T>,
    attributes: Attributes = {},
  ): Promise<T> {
    const workflow = ctx.workflowName;
    const name = `execute ${workflow}`;
    const options = {
      kind: SpanKind.CONSUMER,
      attributes: { "tenon.workflow": workflow },
    };
    return this.tracer.startActiveSpan(name, options, (span) => {
      span.setAttributes(attributes);
      return this.#traced(span, work);
    });
  }

  attempt<T>(
    step: string,
    attempt: WorkflowStepContext,
    work: () => Promise<T>,
  ): Promise<T> {
    const stepName = new StepName(step);
    const kind = stepName.kind();
    const name = `step ${kind}`;
    const attributes = {
      "tenon.step.kind": kind,
      "tenon.step.attempt": attempt.attempt,
    };
    const options = { attributes };
    return this.tracer.startActiveSpan(name, options, (span) =>
      this.#traced(span, work),
    );
  }

  async #traced<T>(span: Span, work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (!isWorkflowInterrupt(error)) this.#failed(span, error);

      throw error;
    } finally {
      span.end();
    }
  }

  #failed(span: Span, error: unknown): void {
    if (!(error instanceof Error)) {
      span.setStatus({ code: SpanStatusCode.ERROR });
      return;
    }

    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
  }
}
