import { Injectable } from "@nestjs/common";
import { Transactional } from "@nestjs-cls/transactional";
import type { AcceptEventCommand } from "./interfaces.js";
import { EventStore } from "./ports.js";

@Injectable()
export class AcceptEvent {
  constructor(private readonly events: EventStore) {}

  @Transactional()
  async execute(command: AcceptEventCommand): Promise<void> {
    const now = new Date();
    await this.events.accept(
      command.cloudEvent,
      command.origin,
      command.instanceId,
      now,
    );
  }
}
