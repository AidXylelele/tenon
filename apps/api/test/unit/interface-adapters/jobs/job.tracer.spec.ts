import { SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { JobTracer } from "../../../../src/interface-adapters/jobs/job.tracer.js";
import { RecordedSpans } from "../../../support/recorded-spans.js";

describe("the span of a scheduled job's run", () => {
  let spans: RecordedSpans;

  beforeEach(() => {
    spans = new RecordedSpans();
  });

  afterEach(async () => {
    await spans.stop();
  });

  it("a_run_is_one_internal_span_named_after_its_job", async () => {
    const tracer = new JobTracer();

    await tracer.run("outbox:prune-inbox", () => Promise.resolve());

    const [run] = spans.named("job outbox:prune-inbox");
    expect(run?.kind).toBe(SpanKind.INTERNAL);
    expect(run?.parentSpanContext).toBeUndefined();
    expect(run?.status.code).toBe(SpanStatusCode.UNSET);
  });

  it("a_run_that_fails_ends_its_span_as_an_error", async () => {
    const tracer = new JobTracer();
    const failing = () => Promise.reject(new Error("The lock store is down"));

    await expect(tracer.run("workflows:purge", failing)).rejects.toThrow(
      "The lock store is down",
    );

    const [run] = spans.named("job workflows:purge");
    expect(run?.status).toEqual({
      code: SpanStatusCode.ERROR,
      message: "The lock store is down",
    });
  });
});
