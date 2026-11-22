import { Injectable } from "@nestjs/common";
import { html, type Mailable, type MailContent } from "@nestjs/mail";
import type { PasswordResetMailData } from "../interfaces.js";

@Injectable()
export class PasswordResetMail implements Mailable<PasswordResetMailData> {
  render(mail: PasswordResetMailData): MailContent {
    const expires = `${mail.expiresAt.replace("T", " ").slice(0, 16)} UTC`;
    return {
      subject: "Reset your Tenon password",
      text: [
        "Someone requested a password reset for your Tenon account.",
        "",
        `Open this link to choose a new password: ${mail.link}`,
        "",
        `The link is valid until ${expires} and can be used once. If you did not request it, ignore this message.`,
      ].join("\n"),
      html: html`
        <p>Someone requested a password reset for your Tenon account.</p>
        <p><a href="${mail.link}">Choose a new password</a></p>
        <p>
          The link is valid until ${expires} and can be used once. If you did
          not request it, ignore this message.
        </p>
      `,
    };
  }
}
