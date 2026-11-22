import {
  Injectable,
  type OnApplicationShutdown,
  type OnModuleInit,
  Optional,
} from "@nestjs/common";
import { LocksEvents } from "@nestjs/locks";
import { type Counter, metrics } from "@opentelemetry/api";
import { Subscription } from "rxjs";

@Injectable()
export class LockMetrics implements OnModuleInit, OnApplicationShutdown {
  private static readonly SCOPE = "tenon-api";

  readonly #subscription = new Subscription();
  readonly #losses: Counter;

  constructor(@Optional() private readonly events?: LocksEvents) {
    const meter = metrics.getMeter(LockMetrics.SCOPE);
    this.#losses = meter.createCounter("tenon.lock.losses", {
      unit: "{loss}",
      description: "The locks a holder lost while using them.",
    });
  }

  onModuleInit(): void {
    if (this.events === undefined) return;

    const recording = this.events.events$.subscribe((event) => {
      if (event.type === "lock-lost") this.#losses.add(1);
    });
    this.#subscription.add(recording);
  }

  onApplicationShutdown(): void {
    this.#subscription.unsubscribe();
  }
}
