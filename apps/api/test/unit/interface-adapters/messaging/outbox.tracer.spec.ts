import type { OutboxHandlerContext, OutboxMessage } from "@nestjs/outbox";
import { SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import { OutboxTracer } from "../../../../src/interface-adapters/messaging/outbox.tracer.js";
import { RecordedSpans } from "../../../support/recorded-spans.js";

const messageOf = (headers: Record<string, string>): OutboxMessage => ({
  id: "0190a1b2-0000-7000-8000-000000000001",
  topic: "event.accepted",
  payload: { sequence: 7 },
  headers,
  key: "events",
  createdAt: 0,
  availableAt: 0,
  attempts: 0,
  lastError: null,
});

const handledOf = (message: OutboxMessage): OutboxHandlerContext => ({
  message,
  consumer: "dispatch",
  attempt: 1,
  signal: new AbortController().signal,
  processInTransaction: () => Promise.reject(new Error("Not used")),
});

describe("the trace an outbox message carries from its producer to its consumer", () => {
  let spans: RecordedSpans;
  let tracer: OutboxTracer;

  beforeEach(() => {
    spans = new RecordedSpans();
    const recording = trace.getTracer("test");
    tracer = new OutboxTracer(recording);
  });

  afterEach(async () => {
    await spans.stop();
  });

  const producedHeaders = (): Record<string, string> =>
    trace.getTracer("test").startActiveSpan("POST /api/v1/events", (span) => {
      const carried = tracer.headers();
      span.end();
      return carried;
    });

  it("a_message_added_inside_a_span_carries_its_trace_context", () => {
    const headers = producedHeaders();

    const [produced] = spans.named("POST /api/v1/events");
    const traceId = produced?.spanContext().traceId ?? "";
    expect(headers.traceparent).toContain(traceId);
  });

  it("a_message_is_processed_in_a_consumer_span_linked_to_its_producer", async () => {
    const headers = producedHeaders();
    const handled = handledOf(messageOf(headers));

    await tracer.processed(handled, () => Promise.resolve());

    const [produced] = spans.named("POST /api/v1/events");
    const [processed] = spans.named("process event.accepted");
    expect(processed?.kind).toBe(SpanKind.CONSUMER);
    expect(processed?.parentSpanContext).toBeUndefined();
    expect(processed?.links.map((link) => link.context.spanId)).toEqual([
      produced?.spanContext().spanId,
    ]);
    expect(processed?.attributes).toEqual({
      "messaging.system": "outbox",
      "messaging.operation.name": "process",
      "messaging.operation.type": "process",
      "messaging.destination.name": "event.accepted",
    });
  });

  it("a_message_without_a_trace_context_is_processed_without_a_link", async () => {
    const handled = handledOf(messageOf({}));

    await tracer.processed(handled, () => Promise.resolve());

    const [processed] = spans.named("process event.accepted");
    expect(processed?.links).toEqual([]);
  });

  it("a_handler_that_fails_ends_its_span_as_an_error", async () => {
    const handled = handledOf(messageOf({}));
    const failing = () => Promise.reject(new Error("The database is down"));

    await expect(tracer.processed(handled, failing)).rejects.toThrow(
      "The database is down",
    );

    const [processed] = spans.named("process event.accepted");
    expect(processed?.status).toEqual({
      code: SpanStatusCode.ERROR,
      message: "The database is down",
    });
  });
});
