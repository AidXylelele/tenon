import { Injectable } from "@nestjs/common";
import type { WorkflowInstance } from "../../../domain/automation/instances/workflow-instance.js";
import { EventOrigin } from "../events/enums.js";
import { EventAnnouncements } from "../events/ports.js";
import { InstanceMessages, LifecycleEvents } from "./ports.js";

@Injectable()
export class InstanceEvents {
  constructor(
    private readonly lifecycle: LifecycleEvents,
    private readonly announcements: EventAnnouncements,
    private readonly messages: InstanceMessages,
  ) {}

  async dispatch(instance: WorkflowInstance): Promise<void> {
    const appended = await this.lifecycle.append(instance);

    for (const event of appended)
      await this.announcements.announce(event, EventOrigin.Lifecycle);

    instance.clearLifecycle();
    await this.messages.dispatch(instance);
  }
}
