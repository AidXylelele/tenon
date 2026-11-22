import {
  type Attributes,
  type Counter,
  createNoopMeter,
  type Histogram,
  metrics,
  type MetricOptions,
} from "@opentelemetry/api";

interface RecordedPoint {
  readonly value: number;
  readonly attributes: Attributes | undefined;
}

export class RecordedMetrics {
  readonly #points = new Map<string, RecordedPoint[]>();
  readonly #options = new Map<string, MetricOptions | undefined>();

  constructor() {
    const meter = createNoopMeter();
    vi.spyOn(meter, "createHistogram").mockImplementation((name, options) =>
      this.#instrument(name, options),
    );
    vi.spyOn(meter, "createCounter").mockImplementation((name, options) =>
      this.#instrument(name, options),
    );
    vi.spyOn(metrics, "getMeter").mockReturnValue(meter);
  }

  pointsOf(name: string): readonly RecordedPoint[] {
    return this.#points.get(name) ?? [];
  }

  optionsOf(name: string): MetricOptions | undefined {
    return this.#options.get(name);
  }

  #instrument(
    name: string,
    options: MetricOptions | undefined,
  ): Histogram & Counter {
    const points: RecordedPoint[] = [];
    this.#points.set(name, points);
    this.#options.set(name, options);
    const recorded = (value: number, attributes?: Attributes): void => {
      points.push({ value, attributes });
    };
    return { record: recorded, add: recorded };
  }
}
