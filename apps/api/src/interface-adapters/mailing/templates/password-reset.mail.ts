import { Injectable } from '@nestjs/common';
import { html, type Mailable, type MailContent } from '@nestjs/mail';
import type { PasswordResetEmail } from '../../interfaces.js';

@Injectable()
export class PasswordResetMail implements Mailable<PasswordResetEmail> {
  render(mail: PasswordResetEmail): MailContent {
    const expires = `${mail.expiresAt.toISOString().replace('T', ' ').slice(0, 16)} UTC`;
    return {
      subject: 'Reset your Workflow Platform password',
      text: [
        'Someone requested a password reset for your Workflow Platform account.',
        '',
        `Open this link to choose a new password: ${mail.link}`,
        '',
        `The link is valid until ${expires} and can be used once. If you did not request it, ignore this message.`,
      ].join('\n'),
      html: html`
        <p>
          Someone requested a password reset for your Workflow Platform account.
        </p>
        <p><a href="${mail.link}">Choose a new password</a></p>
        <p>
          The link is valid until ${expires} and can be used once. If you did
          not request it, ignore this message.
        </p>
      `,
    };
  }
}
