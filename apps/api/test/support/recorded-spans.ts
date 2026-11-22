import { context, propagation, trace } from "@opentelemetry/api";
import { NodeSDK, type NodeSDKConfiguration } from "@opentelemetry/sdk-node";

type SpanProcessor = NonNullable<
  NodeSDKConfiguration["spanProcessors"]
>[number];
type RecordedSpan = Parameters<SpanProcessor["onEnd"]>[0];

export class RecordedSpans {
  readonly #ended: RecordedSpan[] = [];
  readonly #sdk: NodeSDK;

  constructor() {
    const processor: SpanProcessor = {
      onStart: () => undefined,
      onEnd: (span) => {
        this.#ended.push(span);
      },
      forceFlush: () => Promise.resolve(),
      shutdown: () => Promise.resolve(),
    };
    this.#sdk = new NodeSDK({
      autoDetectResources: false,
      instrumentations: [],
      spanProcessors: [processor],
      metricReaders: [],
      logRecordProcessors: [],
    });
    this.#sdk.start();
  }

  named(name: string): readonly RecordedSpan[] {
    return this.#ended.filter((span) => span.name === name);
  }

  childrenOf(parent: RecordedSpan): readonly RecordedSpan[] {
    const id = parent.spanContext().spanId;
    return this.#ended.filter((span) => span.parentSpanContext?.spanId === id);
  }

  async stop(): Promise<void> {
    await this.#sdk.shutdown();
    trace.disable();
    context.disable();
    propagation.disable();
  }
}
