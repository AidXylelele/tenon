import { Injectable } from "@nestjs/common";
import type { OutboxHandlerContext } from "@nestjs/outbox";
import { type Span, SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";

@Injectable()
export class ConsumerSpan {
  private readonly tracer = trace.getTracer("tenon-api");

  around(
    context: OutboxHandlerContext,
    work: () => Promise<void>,
  ): Promise<void> {
    const topic = context.message.topic;
    const name = `process ${topic}`;
    const options = {
      kind: SpanKind.CONSUMER,
      attributes: {
        "messaging.system": "outbox",
        "messaging.operation.name": "process",
        "messaging.operation.type": "process",
        "messaging.destination.name": topic,
      },
    };
    return this.tracer.startActiveSpan(name, options, (span) =>
      this.#traced(span, work),
    );
  }

  async #traced(span: Span, work: () => Promise<void>): Promise<void> {
    try {
      await work();
    } catch (error) {
      this.#failed(span, error);
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
