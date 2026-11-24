import { Injectable } from "@nestjs/common";
import {
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
import { DeliverEvent } from "../../../application/automation/subscriptions/deliver-event.js";
import { FailDelivery } from "../../../application/automation/subscriptions/fail-delivery.js";
import type { DeliveryCommand } from "../../../application/automation/subscriptions/interfaces.js";
import { MessageTopic, SpanAttribute } from "../enums.js";
import type { DeliveryMessage } from "../interfaces.js";

@Injectable()
export class DeliveryHandler {
  static readonly ATTEMPTS = 36;

  private readonly tracer = trace.getTracer("tenon-api");

  constructor(
    private readonly outbox: Outbox,
    private readonly deliverEvent: DeliverEvent,
    private readonly failDelivery: FailDelivery,
  ) {}

  @OnOutboxMessage(MessageTopic.DeliveryRequested, { consumer: "deliveries" })
  async requested(
    message: DeliveryMessage,
    context: OutboxHandlerContext,
  ): Promise<void> {
    const command = {
      subscriptionId: message.subscriptionId,
      sequence: message.sequence,
    };
    const attributes = {
      [SpanAttribute.MessageId]: context.message.id,
      [SpanAttribute.SubscriptionId]: message.subscriptionId,
      [SpanAttribute.EventSequence]: message.sequence,
    };

    try {
      await this.#traced(MessageTopic.DeliveryRequested, attributes, () =>
        this.#delivered(command),
      );
    } catch (error) {
      const exhausted = context.attempt >= DeliveryHandler.ATTEMPTS;

      if (!exhausted) throw error;

      await this.failDelivery.execute(command);
    }

    this.outbox.notify();
  }

  async #delivered(command: DeliveryCommand): Promise<void> {
    const attempted = await this.deliverEvent.execute(command);

    if (!attempted.ok) throw new Error(attempted.failure);
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
