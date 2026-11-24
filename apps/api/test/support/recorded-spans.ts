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

  all(): readonly RecordedSpan[] {
    return this.#ended;
  }

  named(name: string): readonly RecordedSpan[] {
    return this.#ended.filter((span) => span.name === name);
  }

  only(name: string): RecordedSpan {
    const [span, other] = this.named(name);

    if (span === undefined || other !== undefined)
      throw new Error(`Not exactly one span is named '${name}'`);

    return span;
  }

  async stop(): Promise<void> {
    await this.#sdk.shutdown();
    trace.disable();
    context.disable();
    propagation.disable();
  }
}
