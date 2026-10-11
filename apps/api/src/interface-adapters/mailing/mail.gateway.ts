import { Injectable } from '@nestjs/common';
import { Mailer } from '@nestjs/mail';
import type { InvitationEmail, Mailing } from '../../application/interfaces.js';
import type { PasswordResetEmail } from '../interfaces.js';
import { InvitationMail } from './templates/invitation.mail.js';
import { PasswordResetMail } from './templates/password-reset.mail.js';

@Injectable()
export class MailGateway implements Mailing {
  constructor(private readonly mailer: Mailer) {}

  async sendInvitation(email: InvitationEmail): Promise<void> {
    await this.mailer.send(InvitationMail, { to: email.to, data: email });
  }

  async sendPasswordReset(email: PasswordResetEmail): Promise<void> {
    await this.mailer.send(PasswordResetMail, { to: email.to, data: email });
  }
}
