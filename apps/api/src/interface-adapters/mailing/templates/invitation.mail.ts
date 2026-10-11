import { html, type Mailable, type MailContent } from '@nestjs/mail';
import type { InvitationEmail } from '../../../application/interfaces.js';

export class InvitationMail implements Mailable<InvitationEmail> {
  constructor(private readonly webBaseUrl: string) {}

  render(mail: InvitationEmail): MailContent {
    const link = new URL(`${this.webBaseUrl}/invitations/accept`);
    link.searchParams.set('token', mail.token.value);
    const expires = `${mail.expiresAt.toISOString().replace('T', ' ').slice(0, 16)} UTC`;
    return {
      subject: `${mail.inviterName} invited you to Workflow Platform`,
      text: [
        `${mail.inviterName} invited you to join Workflow Platform with the role "${mail.role}".`,
        '',
        `Open this link to set your name and password: ${link.href}`,
        '',
        `The invitation is valid until ${expires}.`,
      ].join('\n'),
      html: html`
        <p>
          ${mail.inviterName} invited you to join Workflow Platform with the
          role <strong>${mail.role}</strong>.
        </p>
        <p>
          <a href="${link.href}">Accept the invitation</a> to set your name and
          password.
        </p>
        <p>The invitation is valid until ${expires}.</p>
      `,
    };
  }
}
