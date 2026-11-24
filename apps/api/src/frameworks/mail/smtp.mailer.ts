import { Injectable } from "@nestjs/common";
import {
  MailError,
  type MailSendResult,
  Mailer as NestMailer,
} from "@nestjs/mail";
import type {
  InvitationMailData,
  MailDelivery,
  Mailer,
  PasswordResetMailData,
  QueuedMail,
} from "../../interface-adapters/mailing/interfaces.js";
import { InvitationMail } from "../../interface-adapters/mailing/templates/invitation.mail.js";
import { PasswordResetMail } from "../../interface-adapters/mailing/templates/password-reset.mail.js";

@Injectable()
export class SmtpMailer implements Mailer {
  constructor(private readonly mailer: NestMailer) {}

  sendInvitation(
    mail: QueuedMail<InvitationMailData>,
    idempotencyKey: string,
    signal: AbortSignal,
  ): Promise<MailDelivery> {
    return this.#delivered(() =>
      this.mailer.send(InvitationMail, {
        to: mail.to,
        data: mail.data,
        idempotencyKey,
        signal,
        retry: false,
      }),
    );
  }

  sendPasswordReset(
    mail: QueuedMail<PasswordResetMailData>,
    idempotencyKey: string,
    signal: AbortSignal,
  ): Promise<MailDelivery> {
    return this.#delivered(() =>
      this.mailer.send(PasswordResetMail, {
        to: mail.to,
        data: mail.data,
        idempotencyKey,
        signal,
        retry: false,
      }),
    );
  }

  async #delivered(send: () => Promise<MailSendResult>): Promise<MailDelivery> {
    try {
      await send();
      return { kind: "sent" };
    } catch (error) {
      if (error instanceof MailError && error.permanent)
        return { kind: "refused", reason: error.message };

      throw error;
    }
  }
}
