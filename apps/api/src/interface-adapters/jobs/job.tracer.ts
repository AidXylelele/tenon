import { type Span, SpanStatusCode, type Tracer } from "@opentelemetry/api";

export class JobTracer {
  constructor(private readonly tracer: Tracer) {}

  run<T>(job: string, work: () => Promise<T>): Promise<T> {
    const name = `job ${job}`;
    return this.tracer.startActiveSpan(name, (span) =>
      this.#traced(span, work),
    );
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
