import { Injectable } from "@nestjs/common";
import {
  NonRetryableMessageError,
  OnOutboxMessage,
  Outbox,
  type OutboxHandlerContext,
} from "@nestjs/outbox";
import {
  type Attributes,
  type Span,
  SpanKind,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api";
import { v5 } from "uuid";
import { DispatchEvent } from "../../../application/automation/events/dispatch-event.js";
import { CancelChildren } from "../../../application/automation/instances/cancel-children.js";
import { CancelInstance } from "../../../application/automation/instances/cancel-instance.js";
import { OfferEvent } from "../../../application/automation/instances/offer-event.js";
import { ContinueSchedule } from "../../../application/automation/schedules/continue-schedule.js";
import { StartOnEvent } from "../../../application/automation/schedules/start-on-event.js";
import { MatchSubscriptions } from "../../../application/automation/subscriptions/match-subscriptions.js";
import { PermanentFault } from "../../interpreter/permanent-fault.error.js";
import { IdNamespace, MessageTopic, SpanAttribute } from "../enums.js";
import type {
  AcceptedEventMessage,
  EventOfferedMessage,
  InstanceMessage,
  TriggerOfferedMessage,
} from "../interfaces.js";

@Injectable()
export class AutomationHandler {
  private readonly tracer = trace.getTracer("tenon-api");

  constructor(
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
    const attributes = {
      [SpanAttribute.MessageId]: context.message.id,
      [SpanAttribute.EventSequence]: message.sequence,
    };
    const traced = () =>
      this.#traced(MessageTopic.EventAccepted, attributes, () =>
        this.dispatchEvent.execute(command),
      );
    return this.#handled(traced);
  }

  @OnOutboxMessage(MessageTopic.EventAccepted, { consumer: "subscriptions" })
  matched(
    message: AcceptedEventMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    const command = { sequence: message.sequence, signal: context.signal };
    const attributes = {
      [SpanAttribute.MessageId]: context.message.id,
      [SpanAttribute.EventSequence]: message.sequence,
    };
    const traced = () =>
      this.#traced(MessageTopic.EventAccepted, attributes, () =>
        this.matchSubscriptions.execute(command),
      );
    return this.#handled(traced);
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
    const attributes = {
      [SpanAttribute.MessageId]: context.message.id,
      [SpanAttribute.InstanceId]: message.instanceId,
      [SpanAttribute.EventSequence]: message.sequence,
    };
    const traced = () =>
      this.#traced(MessageTopic.EventOffered, attributes, () =>
        this.offerEvent.execute(command),
      );
    return this.#handled(traced);
  }

  @OnOutboxMessage(MessageTopic.TriggerOffered, { consumer: "triggers" })
  triggered(
    message: TriggerOfferedMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    const slot = `${message.workflowId}#${String(message.sequence)}`;
    const instanceId = v5(slot, IdNamespace.Instances);
    const command = {
      workflowId: message.workflowId,
      sequence: message.sequence,
      instanceId,
      signal: context.signal,
    };
    const attributes = {
      [SpanAttribute.MessageId]: context.message.id,
      [SpanAttribute.WorkflowId]: message.workflowId,
      [SpanAttribute.EventSequence]: message.sequence,
      [SpanAttribute.InstanceId]: instanceId,
    };
    const traced = () =>
      this.#traced(MessageTopic.TriggerOffered, attributes, () =>
        this.startOnEvent.execute(command),
      );
    return this.#handled(traced);
  }

  @OnOutboxMessage(MessageTopic.ChildrenAbandoned, { consumer: "children" })
  abandoned(
    message: InstanceMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    const command = { instanceId: message.instanceId };
    const attributes = {
      [SpanAttribute.MessageId]: context.message.id,
      [SpanAttribute.InstanceId]: message.instanceId,
    };
    const traced = () =>
      this.#traced(MessageTopic.ChildrenAbandoned, attributes, () =>
        this.cancelChildren.execute(command),
      );
    return this.#handled(traced);
  }

  @OnOutboxMessage(MessageTopic.CancelRequested, { consumer: "runs" })
  cancelRequested(
    message: InstanceMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    const command = { instanceId: message.instanceId, signal: context.signal };
    const attributes = {
      [SpanAttribute.MessageId]: context.message.id,
      [SpanAttribute.InstanceId]: message.instanceId,
    };
    const traced = () =>
      this.#traced(MessageTopic.CancelRequested, attributes, async () => {
        await this.cancelInstance.execute(command);
      });
    return this.#handled(traced);
  }

  @OnOutboxMessage(MessageTopic.ScheduledCompleted, { consumer: "schedules" })
  continued(
    message: InstanceMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    const command = { instanceId: message.instanceId };
    const attributes = {
      [SpanAttribute.MessageId]: context.message.id,
      [SpanAttribute.InstanceId]: message.instanceId,
    };
    const traced = () =>
      this.#traced(MessageTopic.ScheduledCompleted, attributes, () =>
        this.continueSchedule.execute(command),
      );
    return this.#handled(traced);
  }

  async #handled(work: () => Promise<void>): Promise<void> {
    try {
      await work();
    } catch (error) {
      if (error instanceof PermanentFault)
        throw new NonRetryableMessageError(error.message, { cause: error });

      throw error;
    }

    this.outbox.notify();
  }

  #traced(
    topic: MessageTopic,
    attributes: Attributes,
    work: () => Promise<void>,
  ): Promise<void> {
    const name = `process ${topic}`;
    const options = {
      kind: SpanKind.CONSUMER,
      attributes: {
        [SpanAttribute.System]: "outbox",
        [SpanAttribute.OperationName]: "process",
        [SpanAttribute.OperationType]: "process",
        [SpanAttribute.Destination]: topic,
      },
    };
    return this.tracer.startActiveSpan(name, options, (span) =>
      this.#ended(span, attributes, work),
    );
  }

  async #ended(
    span: Span,
    attributes: Attributes,
    work: () => Promise<void>,
  ): Promise<void> {
    span.setAttributes(attributes);

    try {
      await work();
    } catch (error) {
      this.#failed(span, error);
      throw error;
    } finally {
      span.end();
    }
  }

  #failed(span: Span, error: unknown): void {
    if (!(error instanceof Error)) {
      span.setStatus({ code: SpanStatusCode.ERROR });
      return;
    }

    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
  }
}
