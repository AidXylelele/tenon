import { Injectable } from "@nestjs/common";
import {
  OnOutboxMessage,
  Outbox,
  type OutboxHandlerContext,
} from "@nestjs/outbox";
import { v5 } from "uuid";
import { FireSchedule } from "../../application/automation/schedules/fire-schedule.js";
import { StartScheduledInstance } from "../../application/automation/schedules/start-scheduled-instance.js";
import { ConsumerSpan } from "./consumer-span.js";
import { IdNamespace, MessageTopic } from "./enums.js";
import type { ScheduleFiredMessage, ScheduleMessage } from "./interfaces.js";

@Injectable()
export class ScheduleHandler {
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
    const slot = `${message.workflowId}@${String(message.at)}`;
    const instanceId = v5(slot, IdNamespace.Instances);
    const command = { workflowId: message.workflowId, instanceId };
    await this.span.around(context, () =>
      this.startScheduledInstance.execute(command),
    );
    this.outbox.notify();
  }
}
