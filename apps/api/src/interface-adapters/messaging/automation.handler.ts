import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
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
import { UnitOfWork } from "../../application/unit-of-work.js";
import { InstanceEventKind } from "../../domain/automation/instances/enums.js";
import type { Transaction } from "../persistence/interfaces.js";
import { PermanentFault } from "../workflows/permanent-fault.error.js";
import { ConsumerSpan } from "./consumer-span.js";
import { MessageTopic } from "./enums.js";
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
    private readonly txHost: TransactionHost<Transaction>,
    private readonly unitOfWork: UnitOfWork,
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
    return this.#once(context, () =>
      this.dispatchEvent.execute({
        sequence: message.sequence,
        signal: context.signal,
      }),
    );
  }

  @OnOutboxMessage(MessageTopic.EventAccepted, { consumer: "subscriptions" })
  matched(
    message: AcceptedEventMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    return this.#once(context, () =>
      this.matchSubscriptions.execute({
        sequence: message.sequence,
        signal: context.signal,
      }),
    );
  }

  @OnOutboxMessage(MessageTopic.EventOffered, { consumer: "runs" })
  offered(
    message: EventOfferedMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    return this.#once(context, () =>
      this.offerEvent.execute({
        instanceId: message.instanceId,
        sequence: message.sequence,
        candidates: message.candidates,
        signal: context.signal,
      }),
    );
  }

  @OnOutboxMessage(MessageTopic.TriggerOffered, { consumer: "triggers" })
  triggered(
    message: TriggerOfferedMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    return this.#once(context, () =>
      this.startOnEvent.execute({
        workflowId: message.workflowId,
        sequence: message.sequence,
        signal: context.signal,
      }),
    );
  }

  @OnOutboxMessage(InstanceEventKind.Ended, { consumer: "children" })
  ended(
    message: InstanceMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    return this.#once(context, () =>
      this.cancelChildren.execute({ instanceId: message.instanceId }),
    );
  }

  @OnOutboxMessage(InstanceEventKind.ChildrenAbandoned, {
    consumer: "children",
  })
  abandoned(
    message: InstanceMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    return this.#once(context, () =>
      this.cancelChildren.execute({ instanceId: message.instanceId }),
    );
  }

  @OnOutboxMessage(MessageTopic.CancelRequested, { consumer: "runs" })
  cancelRequested(
    message: InstanceMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    return this.#once(context, async () => {
      await this.cancelInstance.execute({
        instanceId: message.instanceId,
        signal: context.signal,
      });
    });
  }

  @OnOutboxMessage(InstanceEventKind.Ended, { consumer: "schedules" })
  continued(
    message: InstanceMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    return this.#once(context, () =>
      this.continueSchedule.execute({ instanceId: message.instanceId }),
    );
  }

  async #once(
    context: OutboxHandlerContext,
    work: () => Promise<void>,
  ): Promise<void> {
    await this.span.around(context, () => this.#processed(context, work));
    this.outbox.notify();
  }

  async #processed(
    context: OutboxHandlerContext,
    work: () => Promise<void>,
  ): Promise<void> {
    try {
      await this.unitOfWork.run(async () => {
        await context.processInTransaction(this.txHost.tx, work);
      });
    } catch (error) {
      if (error instanceof PermanentFault)
        throw new NonRetryableMessageError(error.message, { cause: error });

      throw error;
    }
  }
}
