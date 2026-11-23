import { Injectable } from "@nestjs/common";
import { MailError, Mailer, type MailSendResult } from "@nestjs/mail";
import {
  NonRetryableMessageError,
  OnOutboxMessage,
  type OutboxHandlerContext,
} from "@nestjs/outbox";
import { type Span, SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import { MailTopic } from "./enums.js";
import type {
  InvitationMailData,
  PasswordResetMailData,
  QueuedMail,
} from "./interfaces.js";
import { InvitationMail } from "./templates/invitation.mail.js";
import { PasswordResetMail } from "./templates/password-reset.mail.js";

@Injectable()
export class MailHandler {
  private readonly tracer = trace.getTracer("tenon-api");

  constructor(private readonly mailer: Mailer) {}

  @OnOutboxMessage(MailTopic.Invitation, { consumer: "invitation-mail" })
  sendInvitation(
    mail: QueuedMail<InvitationMailData>,
    context: OutboxHandlerContext,
  ): Promise<void> {
    return this.#delivered(context, () =>
      this.mailer.send(InvitationMail, {
        to: mail.to,
        data: mail.data,
        idempotencyKey: context.message.id,
        signal: context.signal,
        retry: false,
      }),
    );
  }

  @OnOutboxMessage(MailTopic.PasswordReset, {
    consumer: "password-reset-mail",
  })
  sendPasswordReset(
    mail: QueuedMail<PasswordResetMailData>,
    context: OutboxHandlerContext,
  ): Promise<void> {
    return this.#delivered(context, () =>
      this.mailer.send(PasswordResetMail, {
        to: mail.to,
        data: mail.data,
        idempotencyKey: context.message.id,
        signal: context.signal,
        retry: false,
      }),
    );
  }

  #delivered(
    context: OutboxHandlerContext,
    send: () => Promise<MailSendResult>,
  ): Promise<void> {
    const topic = context.message.topic;
    const name = `process ${topic}`;
    const options = {
      kind: SpanKind.CONSUMER,
      attributes: {
        "messaging.system": "outbox",
        "messaging.operation.name": "process",
        "messaging.operation.type": "process",
        "messaging.destination.name": topic,
      },
    };
    return this.tracer.startActiveSpan(name, options, (span) =>
      this.#traced(span, send),
    );
  }

  async #traced(
    span: Span,
    send: () => Promise<MailSendResult>,
  ): Promise<void> {
    try {
      await this.#sent(send);
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

  async #sent(send: () => Promise<MailSendResult>): Promise<void> {
    try {
      await send();
    } catch (error) {
      if (error instanceof MailError && error.permanent)
        throw new NonRetryableMessageError(error.message, { cause: error });

      throw error;
    }
  }
}
