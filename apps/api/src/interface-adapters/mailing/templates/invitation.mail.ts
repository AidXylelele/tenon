import { Injectable } from "@nestjs/common";
import { html, type Mailable, type MailContent } from "@nestjs/mail";
import type { InvitationMailData } from "../interfaces.js";

@Injectable()
export class InvitationMail implements Mailable<InvitationMailData> {
  constructor(private readonly webBaseUrl: string) {}

  render(mail: InvitationMailData): MailContent {
    const link = new URL(`${this.webBaseUrl}/invitations/accept`);
    link.searchParams.set("token", mail.token);
    const expires = `${mail.expiresAt.replace("T", " ").slice(0, 16)} UTC`;
    return {
      subject: `${mail.inviterName} invited you to Tenon`,
      text: [
        `${mail.inviterName} invited you to join Tenon with the role "${mail.role}".`,
        "",
        `Open this link to set your name and password: ${link.href}`,
        "",
        `The invitation is valid until ${expires}.`,
      ].join("\n"),
      html: html`
        <p>
          ${mail.inviterName} invited you to join Tenon with the role
          <strong>${mail.role}</strong>.
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
