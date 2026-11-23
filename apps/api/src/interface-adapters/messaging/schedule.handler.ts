import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import {
  OnOutboxMessage,
  Outbox,
  type OutboxHandlerContext,
} from "@nestjs/outbox";
import { FireSchedule } from "../../application/automation/schedules/fire-schedule.js";
import { StartScheduledInstance } from "../../application/automation/schedules/start-scheduled-instance.js";
import { ConsumerSpan } from "./consumer-span.js";
import { MessageTopic } from "./enums.js";
import type { ScheduleFiredMessage, ScheduleMessage } from "./interfaces.js";

@Injectable()
export class ScheduleHandler {
  private static readonly VERSION = "8";
  private static readonly VARIANT = "8";

  constructor(
    private readonly span: ConsumerSpan,
    private readonly outbox: Outbox,
    private readonly fireSchedule: FireSchedule,
    private readonly startScheduledInstance: StartScheduledInstance,
  ) {}

  @OnOutboxMessage(MessageTopic.ScheduleArmed, { consumer: "schedules" })
  async armed(
    message: ScheduleMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    const command = {
      workflowId: message.workflowId,
      arming: message.arming,
      at: message.at,
    };
    await this.span.around(context, () => this.fireSchedule.execute(command));
    this.outbox.notify();
  }

  @OnOutboxMessage(MessageTopic.ScheduleFired, { consumer: "schedules" })
  async fired(
    message: ScheduleFiredMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    const instanceId = this.#instanceIdOf(message);
    const command = { workflowId: message.workflowId, instanceId };
    await this.span.around(context, () =>
      this.startScheduledInstance.execute(command),
    );
    this.outbox.notify();
  }

  #instanceIdOf(message: ScheduleFiredMessage): string {
    const slot = `${message.workflowId}@${String(message.at)}`;
    const hex = createHash("sha256").update(slot).digest("hex");
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      ScheduleHandler.VERSION + hex.slice(13, 16),
      ScheduleHandler.VARIANT + hex.slice(17, 20),
      hex.slice(20, 32),
    ].join("-");
  }
}
