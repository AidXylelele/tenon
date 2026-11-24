import { Injectable } from "@nestjs/common";
import {
  NonRetryableMessageError,
  OnOutboxMessage,
  type OutboxHandlerContext,
} from "@nestjs/outbox";
import {
  type Attributes,
  type Span,
  SpanKind,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api";
import { SpanAttribute } from "../messaging/enums.js";
import { MailTopic } from "./enums.js";
import {
  type InvitationMailData,
  type MailDelivery,
  Mailer,
  type PasswordResetMailData,
  type QueuedMail,
} from "./interfaces.js";

@Injectable()
export class MailHandler {
  private readonly tracer = trace.getTracer("tenon-api");

  constructor(private readonly mailer: Mailer) {}

  @OnOutboxMessage(MailTopic.Invitation, { consumer: "invitation-mail" })
  sendInvitation(
    mail: QueuedMail<InvitationMailData>,
    context: OutboxHandlerContext,
  ): Promise<void> {
    const idempotencyKey = context.message.id;
    const attributes = { [SpanAttribute.MessageId]: idempotencyKey };
    return this.#traced(MailTopic.Invitation, attributes, async () => {
      const delivery = await this.mailer.sendInvitation(
        mail,
        idempotencyKey,
        context.signal,
      );
      this.#accepted(delivery);
    });
  }

  @OnOutboxMessage(MailTopic.PasswordReset, {
    consumer: "password-reset-mail",
  })
  sendPasswordReset(
    mail: QueuedMail<PasswordResetMailData>,
    context: OutboxHandlerContext,
  ): Promise<void> {
    const idempotencyKey = context.message.id;
    const attributes = { [SpanAttribute.MessageId]: idempotencyKey };
    return this.#traced(MailTopic.PasswordReset, attributes, async () => {
      const delivery = await this.mailer.sendPasswordReset(
        mail,
        idempotencyKey,
        context.signal,
      );
      this.#accepted(delivery);
    });
  }

  #accepted(delivery: MailDelivery): void {
    if (delivery.kind === "refused")
      throw new NonRetryableMessageError(delivery.reason);
  }

  #traced(
    topic: MailTopic,
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
