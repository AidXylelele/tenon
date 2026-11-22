import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { type OutboxEvent, OutboxEvents } from "@nestjs/outbox";

@Injectable()
export class OutboxLogger implements OnModuleInit {
  private readonly logger = new Logger(OutboxLogger.name);

  constructor(private readonly events: OutboxEvents) {}

  onModuleInit(): void {
    this.events.events$.subscribe((event) => {
      this.#log(event);
    });
  }

  #log(event: OutboxEvent): void {
    if (event.type !== "dead-lettered") return;

    this.logger.error(
      {
        messageId: event.message.id,
        topic: event.message.topic,
        transport: event.transport,
        attempt: event.attempt,
        reason: event.reason,
        err: event.error,
      },
      `The outbox dead-lettered a ${event.message.topic} message`,
    );
  }
}
