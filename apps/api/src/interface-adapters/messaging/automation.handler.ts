import { Injectable } from "@nestjs/common";
import {
  NonRetryableMessageError,
  OnOutboxMessage,
  Outbox,
  type OutboxHandlerContext,
} from "@nestjs/outbox";
import { DispatchEvent } from "../../application/automation/events/dispatch-event.js";
import { CancelChildren } from "../../application/automation/instances/cancel-children.js";
import { CancelInstance } from "../../application/automation/instances/cancel-instance.js";
import { OfferEvent } from "../../application/automation/instances/offer-event.js";
import { ContinueSchedule } from "../../application/automation/schedules/continue-schedule.js";
import { StartOnEvent } from "../../application/automation/schedules/start-on-event.js";
import { MatchSubscriptions } from "../../application/automation/subscriptions/match-subscriptions.js";
import { PermanentFault } from "../workflows/permanent-fault.error.js";
import { ConsumerSpan } from "./consumer-span.js";
import { MessageTopic } from "./enums.js";
import { instanceIdOf } from "./instance-id.js";
import type {
  AcceptedEventMessage,
  EventOfferedMessage,
  InstanceMessage,
  TriggerOfferedMessage,
} from "./interfaces.js";

@Injectable()
export class AutomationHandler {
  constructor(
    private readonly span: ConsumerSpan,
    private readonly outbox: Outbox,
    private readonly dispatchEvent: DispatchEvent,
    private readonly offerEvent: OfferEvent,
    private readonly startOnEvent: StartOnEvent,
    private readonly matchSubscriptions: MatchSubscriptions,
    private readonly cancelChildren: CancelChildren,
    private readonly cancelInstance: CancelInstance,
    private readonly continueSchedule: ContinueSchedule,
  ) {}

  @OnOutboxMessage(MessageTopic.EventAccepted, { consumer: "dispatch" })
  dispatched(
    message: AcceptedEventMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    const command = { sequence: message.sequence, signal: context.signal };
    return this.#handled(context, () => this.dispatchEvent.execute(command));
  }

  @OnOutboxMessage(MessageTopic.EventAccepted, { consumer: "subscriptions" })
  matched(
    message: AcceptedEventMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    const command = { sequence: message.sequence, signal: context.signal };
    return this.#handled(context, () =>
      this.matchSubscriptions.execute(command),
    );
  }

  @OnOutboxMessage(MessageTopic.EventOffered, { consumer: "runs" })
  offered(
    message: EventOfferedMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    const command = {
      instanceId: message.instanceId,
      sequence: message.sequence,
      candidates: message.candidates,
      signal: context.signal,
    };
    return this.#handled(context, () => this.offerEvent.execute(command));
  }

  @OnOutboxMessage(MessageTopic.TriggerOffered, { consumer: "triggers" })
  triggered(
    message: TriggerOfferedMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    const slot = `${message.workflowId}#${String(message.sequence)}`;
    const instanceId = instanceIdOf(slot);
    const command = {
      workflowId: message.workflowId,
      sequence: message.sequence,
      instanceId,
      signal: context.signal,
    };
    return this.#handled(context, () => this.startOnEvent.execute(command));
  }

  @OnOutboxMessage(MessageTopic.ChildrenAbandoned, { consumer: "children" })
  abandoned(
    message: InstanceMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    const command = { instanceId: message.instanceId };
    return this.#handled(context, () => this.cancelChildren.execute(command));
  }

  @OnOutboxMessage(MessageTopic.CancelRequested, { consumer: "runs" })
  cancelRequested(
    message: InstanceMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    const command = { instanceId: message.instanceId, signal: context.signal };
    return this.#handled(context, async () => {
      await this.cancelInstance.execute(command);
    });
  }

  @OnOutboxMessage(MessageTopic.ScheduledCompleted, { consumer: "schedules" })
  continued(
    message: InstanceMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    const command = { instanceId: message.instanceId };
    return this.#handled(context, () => this.continueSchedule.execute(command));
  }

  async #handled(
    context: OutboxHandlerContext,
    work: () => Promise<void>,
  ): Promise<void> {
    try {
      await this.span.around(context, work);
    } catch (error) {
      if (error instanceof PermanentFault)
        throw new NonRetryableMessageError(error.message, { cause: error });

      throw error;
    }

    this.outbox.notify();
  }
}
