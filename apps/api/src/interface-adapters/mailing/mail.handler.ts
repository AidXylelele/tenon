import { Injectable } from "@nestjs/common";
import { MailError, Mailer, type MailSendResult } from "@nestjs/mail";
import {
  NonRetryableMessageError,
  OnOutboxMessage,
  type OutboxHandlerContext,
} from "@nestjs/outbox";
import { OutboxTracer } from "../messaging/outbox.tracer.js";
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
  constructor(
    private readonly mailer: Mailer,
    private readonly tracer: OutboxTracer,
  ) {}

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
    return this.tracer.processed(context, () => this.#sent(send));
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
