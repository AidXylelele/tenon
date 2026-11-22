import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Outbox } from "@nestjs/outbox";
import type { RecoveryMailer } from "../../application/identity/accounts/ports.js";
import type { InvitationMailer } from "../../application/identity/invitations/ports.js";
import type { Invitation } from "../../domain/identity/invitations/invitation.js";
import type { InvitationToken } from "../../domain/identity/invitations/invitation-token.js";
import { OutboxTracer } from "../messaging/outbox.tracer.js";
import type { Transaction } from "../persistence/interfaces.js";
import { MailTopic } from "./enums.js";
import type {
  InvitationMailData,
  PasswordResetMailData,
  QueuedMail,
} from "./interfaces.js";

@Injectable()
export class MailGateway implements InvitationMailer, RecoveryMailer {
  constructor(
    private readonly outbox: Outbox,
    private readonly txHost: TransactionHost<Transaction>,
    private readonly tracer: OutboxTracer,
  ) {}

  async sendInvitation(
    invitation: Invitation,
    token: InvitationToken,
    inviterName: string,
  ): Promise<void> {
    const data: InvitationMailData = {
      token: token.value,
      inviterName,
      role: invitation.role,
      expiresAt: invitation.expiresAt.toISOString(),
    };
    const mail: QueuedMail<InvitationMailData> = {
      to: invitation.email,
      data,
    };
    await this.#queue(MailTopic.Invitation, mail);
  }

  async sendPasswordReset(
    to: string,
    link: string,
    expiresAt: Date,
  ): Promise<void> {
    const data: PasswordResetMailData = {
      link,
      expiresAt: expiresAt.toISOString(),
    };
    const mail: QueuedMail<PasswordResetMailData> = { to, data };
    await this.#queue(MailTopic.PasswordReset, mail);
  }

  async #queue<T>(topic: MailTopic, payload: QueuedMail<T>): Promise<void> {
    await this.txHost.withTransaction(async () => {
      await this.outbox.add(this.txHost.tx, {
        topic,
        payload,
        headers: this.tracer.headers(),
      });
    });
  }
}
