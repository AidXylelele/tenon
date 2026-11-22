import {
  context,
  propagation,
  SpanKind,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api";
import type { AsyncApiOutcome } from "interpreter";
import { BrokerSpans } from "../../../src/frameworks/asyncapi/broker-spans.js";
import type { BrokerTarget } from "../../../src/frameworks/asyncapi/interfaces.js";
import { startTracing, type Tracing } from "../../support/tracing.js";

const TARGET: BrokerTarget = {
  kind: "target",
  server: {
    url: "kafka://127.0.0.1:9092",
    protocol: "kafka",
    protocolVersion: null,
    hostname: "127.0.0.1",
    port: 9092,
    pathname: "",
    secure: false,
  },
  address: "orders",
  contentType: "application/json",
  bindings: { channel: {}, operation: {} },
};
const PRODUCER_TRACE = "4bf92f3577b34da6a3ce929d0e0e4736";
const PRODUCER_SPAN = "00f067aa0ba902b7";
const PRODUCED = { traceparent: `00-${PRODUCER_TRACE}-${PRODUCER_SPAN}-01` };

describe("the spans of the messages a host sends and processes", () => {
  let tracing: Tracing;
  const spans = new BrokerSpans();

  beforeAll(() => {
    tracing = startTracing();
  });

  afterAll(async () => {
    await tracing.shutdown();
  });

  beforeEach(() => {
    tracing.ended.length = 0;
  });

  it("a_send_is_a_producer_span_whose_context_the_message_carries", async () => {
    const carried: Record<string, string> = {};
    const publish = () => {
      const active = context.active();
      propagation.inject(active, carried);
      return Promise.resolve<AsyncApiOutcome>({ kind: "published" });
    };

    const outcome = await spans.sending(TARGET, "kafka", publish);
    const span = tracing.named("send orders");

    expect(outcome).toEqual({ kind: "published" });
    expect(span.kind).toBe(SpanKind.PRODUCER);
    expect(span.attributes).toEqual({
      "messaging.system": "kafka",
      "messaging.operation.name": "send",
      "messaging.operation.type": "send",
      "messaging.destination.name": "orders",
    });
    expect(span.status.code).toBe(SpanStatusCode.UNSET);
    expect(carried.traceparent).toContain(span.spanContext().spanId);
  });

  it("a_send_the_broker_refuses_is_an_error_of_the_failure_kind", async () => {
    const refused: AsyncApiOutcome = {
      kind: "unreachable",
      detail: "connect ECONNREFUSED",
    };
    const publish = () => Promise.resolve<AsyncApiOutcome>(refused);

    const outcome = await spans.sending(TARGET, "kafka", publish);
    const span = tracing.named("send orders");

    expect(outcome).toEqual(refused);
    expect(span.status.code).toBe(SpanStatusCode.ERROR);
    expect(span.attributes["error.type"]).toBe("unreachable");
  });

  it("a_send_that_throws_records_the_exception_and_rethrows", async () => {
    const publish = () => Promise.reject(new Error("The step was cancelled"));

    const sending = spans.sending(TARGET, "kafka", publish);

    await expect(sending).rejects.toThrow("The step was cancelled");
    const span = tracing.named("send orders");
    expect(span.status.code).toBe(SpanStatusCode.ERROR);
    expect(span.events.map((event) => event.name)).toEqual(["exception"]);
  });

  it("a_processed_message_is_a_consumer_span_linked_to_where_it_was_produced", async () => {
    let active: string | undefined;
    const deliver = () => {
      active = trace.getActiveSpan()?.spanContext().spanId;
      return Promise.resolve();
    };

    await spans.processing(TARGET, "kafka", PRODUCED, deliver);
    const span = tracing.named("process orders");

    expect(span.kind).toBe(SpanKind.CONSUMER);
    expect(span.attributes).toEqual({
      "messaging.system": "kafka",
      "messaging.operation.name": "process",
      "messaging.operation.type": "process",
      "messaging.destination.name": "orders",
    });
    expect(span.links.map((link) => link.context.spanId)).toEqual([
      PRODUCER_SPAN,
    ]);
    expect(span.spanContext().traceId).not.toBe(PRODUCER_TRACE);
    expect(active).toBe(span.spanContext().spanId);
  });

  it("a_message_without_a_trace_context_is_processed_without_a_link", async () => {
    const deliver = () => Promise.resolve();

    await spans.processing(TARGET, "redis", {}, deliver);
    const span = tracing.named("process orders");

    expect(span.links).toEqual([]);
  });

  it("a_delivery_that_fails_marks_its_span_as_an_error_and_rethrows", async () => {
    const deliver = () => Promise.reject(new Error("The store is down"));

    const processing = spans.processing(TARGET, "kafka", PRODUCED, deliver);

    await expect(processing).rejects.toThrow("The store is down");
    const span = tracing.named("process orders");
    expect(span.status.code).toBe(SpanStatusCode.ERROR);
  });
});
