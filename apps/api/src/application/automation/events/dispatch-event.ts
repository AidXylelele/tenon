import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import type { DispatchEventCommand } from "./interfaces.js";
import {
  EventListeners,
  EventOffers,
  EventRouting,
  EventStore,
} from "./ports.js";

@Injectable()
export class DispatchEvent {
  constructor(
    private readonly events: EventStore,
    private readonly listeners: EventListeners,
    private readonly routing: EventRouting,
    private readonly offers: EventOffers,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: DispatchEventCommand): Promise<void> {
    const event = await this.events.find(command.sequence);

    if (event === null) return;

    const programs = await this.listeners.programsFor(event);
    const matches = await this.routing.accepting(
      programs,
      event,
      command.signal,
    );

    if (matches.length === 0) return;

    const offers = await this.listeners.instancesFor(matches, event);
    const workflowIds = await this.listeners.workflowsFor(matches);
    await this.unitOfWork.run(async () => {
      await this.offers.offer(offers, event);
      await this.offers.trigger(workflowIds, event);
    });
  }
}
