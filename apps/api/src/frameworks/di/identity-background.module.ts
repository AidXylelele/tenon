import { Module } from "@nestjs/common";
import { ConfigModule, type ConfigType } from "@nestjs/config";
import { MailModule, SmtpTransport } from "@nestjs/mail";
import { MailHandler } from "../../interface-adapters/mailing/mail.handler.js";
import { InvitationMail } from "../../interface-adapters/mailing/templates/invitation.mail.js";
import { PasswordResetMail } from "../../interface-adapters/mailing/templates/password-reset.mail.js";
import { linksConfig, mailConfig } from "./configs.js";

@Module({
  imports: [
    ConfigModule.forFeature(linksConfig),
    MailModule.forRootAsync({
      imports: [ConfigModule.forFeature(mailConfig)],
      inject: [mailConfig.KEY],
      useFactory: (mail: ConfigType<typeof mailConfig>) => ({
        transport: new SmtpTransport({
          host: mail.SMTP_HOST,
          port: mail.SMTP_PORT,
          startTls: mail.SMTP_STARTTLS,
          auth: mail.SMTP_USER
            ? { user: mail.SMTP_USER, pass: mail.SMTP_PASSWORD }
            : undefined,
          pool: true,
        }),
        from: mail.SMTP_FROM,
      }),
    }),
  ],
  providers: [
    MailHandler,
    {
      provide: InvitationMail,
      inject: [linksConfig.KEY],
      useFactory: (links: ConfigType<typeof linksConfig>) =>
        new InvitationMail(links.WEB_BASE_URL),
    },
    PasswordResetMail,
  ],
})
export class IdentityBackgroundModule {}
