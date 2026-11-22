import { NodeSDK, type NodeSDKConfiguration } from "@opentelemetry/sdk-node";

type SpanProcessor = NonNullable<
  NodeSDKConfiguration["spanProcessors"]
>[number];

export type EndedSpan = Parameters<SpanProcessor["onEnd"]>[0];

export interface Tracing {
  readonly ended: EndedSpan[];
  named(name: string): EndedSpan;
  shutdown(): Promise<void>;
}

export function startTracing(): Tracing {
  const ended: EndedSpan[] = [];
  const collector: SpanProcessor = {
    onStart: () => undefined,
    onEnd: (span) => {
      ended.push(span);
    },
    forceFlush: () => Promise.resolve(),
    shutdown: () => Promise.resolve(),
  };
  const sdk = new NodeSDK({
    autoDetectResources: false,
    instrumentations: [],
    spanProcessors: [collector],
    metricReaders: [],
    logRecordProcessors: [],
  });
  sdk.start();
  return {
    ended,
    named: (name) => {
      const span = ended.find((candidate) => candidate.name === name);

      if (span === undefined) throw new Error(`No span is named '${name}'`);

      return span;
    },
    shutdown: () => sdk.shutdown(),
  };
}
