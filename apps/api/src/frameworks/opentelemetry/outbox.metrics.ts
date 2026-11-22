import {
  Injectable,
  type OnApplicationShutdown,
  type OnModuleInit,
} from "@nestjs/common";
import {
  type OutboxEvent,
  OutboxEvents,
  type OutboxMessage,
  type OutboxPublishedEvent,
} from "@nestjs/outbox";
import { type Counter, type Histogram, metrics } from "@opentelemetry/api";
import { Subscription } from "rxjs";
import { Instrumentation } from "./enums.js";
import { durationBoundaries } from "./histogram.presets.js";

@Injectable()
export class OutboxMetrics implements OnModuleInit, OnApplicationShutdown {
  readonly #subscription = new Subscription();
  readonly #publishDuration: Histogram;
  readonly #lag: Histogram;
  readonly #failures: Counter;

  constructor(private readonly events: OutboxEvents) {
    const meter = metrics.getMeter(Instrumentation.Scope);
    this.#publishDuration = meter.createHistogram(
      "tenon.outbox.publish.duration",
      {
        unit: "s",
        description: "The time a transport took to accept a message.",
        advice: { explicitBucketBoundaries: durationBoundaries },
      },
    );
    this.#lag = meter.createHistogram("tenon.outbox.lag", {
      unit: "s",
      description: "The time from adding a message to its publish.",
      advice: { explicitBucketBoundaries: durationBoundaries },
    });
    this.#failures = meter.createCounter("tenon.outbox.failures", {
      unit: "{failure}",
      description: "The publishes that failed.",
    });
  }

  onModuleInit(): void {
    const recording = this.events.events$.subscribe((event) => {
      this.#recorded(event);
    });
    this.#subscription.add(recording);
  }

  onApplicationShutdown(): void {
    this.#subscription.unsubscribe();
  }

  #recorded(event: OutboxEvent): void {
    switch (event.type) {
      case "published":
        return this.#published(event);
      case "retry-scheduled":
        return this.#failed(event.message, "retry");
      case "dead-lettered":
        return this.#failed(event.message, "dead_letter");
      case "lease-lost":
        return;
    }
  }

  #published(event: OutboxPublishedEvent): void {
    const topic = event.message.topic;
    const published = {
      "tenon.outbox.topic": topic,
      "tenon.outbox.transport": event.transport,
    };
    const lagged = { "tenon.outbox.topic": topic };
    const seconds = event.durationMs / 1000;
    const lag = (Date.now() - event.message.createdAt) / 1000;
    this.#publishDuration.record(seconds, published);
    this.#lag.record(lag, lagged);
  }

  #failed(message: OutboxMessage, failure: string): void {
    const attributes = {
      "tenon.outbox.topic": message.topic,
      "tenon.outbox.failure": failure,
    };
    this.#failures.add(1, attributes);
  }
}
