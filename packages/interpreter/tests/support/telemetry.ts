import { metrics, trace } from "@opentelemetry/api";
import {
  AggregationTemporality,
  type DataPoint,
  DataPointType,
  type Histogram,
  InMemoryMetricExporter,
  MeterProvider,
  type MetricData,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import {
  InMemorySpanExporter,
  type ReadableSpan,
  SimpleSpanProcessor,
  TracerProvider,
} from "@opentelemetry/sdk-trace";

const anHour = 3_600_000;

export class TelemetryRecording {
  readonly #spans = new InMemorySpanExporter();
  readonly #metrics = new InMemoryMetricExporter(AggregationTemporality.DELTA);
  readonly #reader = new PeriodicExportingMetricReader({
    exporter: this.#metrics,
    exportIntervalMillis: anHour,
  });
  readonly #tracerProvider = new TracerProvider({
    spanProcessors: [new SimpleSpanProcessor({ exporter: this.#spans })],
  });
  readonly #meterProvider = new MeterProvider({ readers: [this.#reader] });

  register(): void {
    trace.setGlobalTracerProvider(this.#tracerProvider);
    metrics.setGlobalMeterProvider(this.#meterProvider);
  }

  async clear(): Promise<void> {
    await this.#reader.forceFlush();
    this.#metrics.reset();
    this.#spans.reset();
  }

  async unregister(): Promise<void> {
    await this.#meterProvider.shutdown();
    await this.#tracerProvider.shutdown();
    trace.disable();
    metrics.disable();
  }

  spans(): readonly ReadableSpan[] {
    return this.#spans.getFinishedSpans();
  }

  spanNamed(name: string): ReadableSpan {
    const found = this.spans().find((span) => span.name === name);

    if (found === undefined) {
      throw new Error(`No span is named ${name}.`);
    }

    return found;
  }

  async points(name: string): Promise<readonly DataPoint<Histogram>[]> {
    await this.#reader.forceFlush();
    const exports = this.#metrics.getMetrics();
    const scopes = exports.flatMap((resource) => resource.scopeMetrics);
    const named = scopes
      .flatMap((scope) => scope.metrics)
      .filter((metric) => metric.descriptor.name === name);

    return named.flatMap((metric) => this.#histogramPointsOf(metric));
  }

  #histogramPointsOf(metric: MetricData): readonly DataPoint<Histogram>[] {
    if (metric.dataPointType !== DataPointType.HISTOGRAM) {
      return [];
    }

    return metric.dataPoints;
  }
}
