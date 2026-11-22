import { Injectable } from "@nestjs/common";
import { MailError, Mailer, type MailSendResult } from "@nestjs/mail";
import {
  NonRetryableMessageError,
  OnOutboxMessage,
  type OutboxHandlerContext,
} from "@nestjs/outbox";
import { MailTopic } from "../mailing/enums.js";
import type {
  InvitationMailData,
  PasswordResetMailData,
  QueuedMail,
} from "../mailing/interfaces.js";
import { InvitationMail } from "../mailing/templates/invitation.mail.js";
import { PasswordResetMail } from "../mailing/templates/password-reset.mail.js";

@Injectable()
export class MailHandler {
  constructor(private readonly mailer: Mailer) {}

  @OnOutboxMessage(MailTopic.Invitation, { consumer: "invitation-mail" })
  async sendInvitation(
    mail: QueuedMail<InvitationMailData>,
    { message, signal }: OutboxHandlerContext,
  ): Promise<void> {
    const sending = this.mailer.send(InvitationMail, {
      to: mail.to,
      data: mail.data,
      idempotencyKey: message.id,
      signal,
      retry: false,
    });
    await this.#delivered(sending);
  }

  @OnOutboxMessage(MailTopic.PasswordReset, {
    consumer: "password-reset-mail",
  })
  async sendPasswordReset(
    mail: QueuedMail<PasswordResetMailData>,
    { message, signal }: OutboxHandlerContext,
  ): Promise<void> {
    const sending = this.mailer.send(PasswordResetMail, {
      to: mail.to,
      data: mail.data,
      idempotencyKey: message.id,
      signal,
      retry: false,
    });
    await this.#delivered(sending);
  }

  async #delivered(sending: Promise<MailSendResult>): Promise<void> {
    try {
      await sending;
    } catch (error) {
      if (error instanceof MailError && error.permanent)
        throw new NonRetryableMessageError(error.message, { cause: error });

      throw error;
    }
  }
}
