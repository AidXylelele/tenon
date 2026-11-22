import { Injectable } from "@nestjs/common";
import { Transactional } from "@nestjs-cls/transactional";
import type { DispatchEventCommand } from "./interfaces.js";
import { EventOffers, EventRouting, EventStore } from "./ports.js";

@Injectable()
export class DispatchEvent {
  constructor(
    private readonly events: EventStore,
    private readonly routing: EventRouting,
    private readonly offers: EventOffers,
  ) {}

  @Transactional()
  async execute(command: DispatchEventCommand): Promise<void> {
    const event = await this.events.find(command.sequence);

    if (event === null) return;

    const programs = await this.offers.programsFor(event);
    const matches = await this.routing.accepting(
      programs,
      event,
      command.signal,
    );
    await this.offers.offer(matches, event);
    await this.offers.trigger(matches, event);
  }
}
