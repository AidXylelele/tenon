import { Injectable } from "@nestjs/common";
import type { OutboxHandlerContext } from "@nestjs/outbox";
import {
  context,
  type Link,
  propagation,
  ROOT_CONTEXT,
  type Span,
  SpanKind,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api";

@Injectable()
export class OutboxTracer {
  private static readonly SCOPE = "tenon-api";
  private static readonly SYSTEM = "outbox";
  private static readonly OPERATION = "process";

  readonly #tracer = trace.getTracer(OutboxTracer.SCOPE);

  headers(): Record<string, string> {
    const carrier: Record<string, string> = {};
    const active = context.active();
    propagation.inject(active, carrier);
    return carrier;
  }

  processed<T>(
    handled: OutboxHandlerContext,
    work: () => Promise<T>,
  ): Promise<T> {
    const topic = handled.message.topic;
    const name = `${OutboxTracer.OPERATION} ${topic}`;
    const links = this.#linksOf(handled.message.headers);
    const attributes = {
      "messaging.system": OutboxTracer.SYSTEM,
      "messaging.operation.name": OutboxTracer.OPERATION,
      "messaging.operation.type": OutboxTracer.OPERATION,
      "messaging.destination.name": topic,
    };
    const options = { kind: SpanKind.CONSUMER, links, attributes };
    return this.#tracer.startActiveSpan(name, options, (span) =>
      this.#traced(span, work),
    );
  }

  #linksOf(headers: Record<string, string>): Link[] {
    const produced = propagation.extract(ROOT_CONTEXT, headers);
    const producer = trace.getSpanContext(produced);

    if (producer === undefined) return [];

    return [{ context: producer }];
  }

  async #traced<T>(span: Span, work: () => Promise<T>): Promise<T> {
    try {
      return await work();
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
