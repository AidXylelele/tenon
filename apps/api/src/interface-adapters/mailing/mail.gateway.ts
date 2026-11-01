import { Injectable } from '@nestjs/common';
import { Mailer } from '@nestjs/mail';
import type { Mailing } from '../../application/identity/ports.js';
import type { Invitation } from '../../domain/identity/invitation.js';
import type { InvitationToken } from '../../domain/identity/invitation-token.js';
import type {
  InvitationMailData,
  PasswordResetMailData,
} from './interfaces.js';
import { InvitationMail } from './templates/invitation.mail.js';
import { PasswordResetMail } from './templates/password-reset.mail.js';

@Injectable()
export class MailGateway implements Mailing {
  constructor(private readonly mailer: Mailer) {}

  async sendInvitation(
    invitation: Invitation,
    token: InvitationToken,
    inviterName: string,
  ): Promise<void> {
    const data: InvitationMailData = {
      token,
      inviterName,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    };
    const to = invitation.email;
    await this.mailer.send(InvitationMail, { to, data });
  }

  async sendPasswordReset(
    to: string,
    link: string,
    expiresAt: Date,
  ): Promise<void> {
    const data: PasswordResetMailData = { link, expiresAt };
    await this.mailer.send(PasswordResetMail, { to, data });
  }
}
