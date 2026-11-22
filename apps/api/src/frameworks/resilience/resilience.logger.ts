import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { type ResilienceEvent, ResilienceEvents } from "@nestjs/resilience";

@Injectable()
export class ResilienceLogger implements OnModuleInit {
  private readonly logger = new Logger(ResilienceLogger.name);

  constructor(private readonly events: ResilienceEvents) {}

  onModuleInit(): void {
    this.events.events$.subscribe((event) => {
      this.#log(event);
    });
  }

  #log(event: ResilienceEvent): void {
    switch (event.type) {
      case "circuit-open":
      case "circuit-half-open":
      case "circuit-closed":
        this.logger.warn(
          { policy: event.policy, from: event.from, to: event.to },
          `The ${event.policy} circuit went from ${event.from} to ${event.to}`,
        );
        return;
      case "bulkhead-rejected":
        this.logger.warn(
          {
            policy: event.policy,
            source: event.source,
            reason: event.reason,
            active: event.active,
            queued: event.queued,
          },
          `The ${event.policy} bulkhead is at capacity`,
        );
        return;
      case "retry":
      case "timeout":
      case "circuit-rejected":
      case "rate-limited":
      case "fallback":
        return;
    }
  }
}
