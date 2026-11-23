import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import type { AcceptEventCommand } from "./interfaces.js";
import { EventAnnouncements, EventStore } from "./ports.js";

@Injectable()
export class AcceptEvent {
  constructor(
    private readonly events: EventStore,
    private readonly announcements: EventAnnouncements,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: AcceptEventCommand): Promise<void> {
    const now = new Date();
    await this.unitOfWork.run(async () => {
      const accepted = await this.events.accept(
        command.cloudEvent,
        command.origin,
        command.instanceId,
        now,
      );

      if (accepted === null) return;

      await this.announcements.announce(accepted, command.origin);
    });
  }
}
