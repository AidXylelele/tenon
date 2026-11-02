import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailModule as NestMailModule, SmtpTransport } from '@nestjs/mail';
import { Mailing } from '../../application/identity/ports.js';
import { MailOutboxHandler } from '../outbox/mail-outbox.handler.js';
import { MailGateway } from '../../interface-adapters/mailing/mail.gateway.js';
import { OutboxMailTransport } from '../mail/outbox-mail.transport.js';
import { InvitationMail } from '../../interface-adapters/mailing/templates/invitation.mail.js';
import { PasswordResetMail } from '../../interface-adapters/mailing/templates/password-reset.mail.js';
import type { Env } from './config.module.js';

@Module({
  imports: [
    NestMailModule.forRootAsync({
      transport: OutboxMailTransport,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        from: config.get('SMTP_FROM', { infer: true }),
        retry: false,
      }),
    }),
  ],
  providers: [
    {
      provide: SmtpTransport,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new SmtpTransport({
          host: config.get('SMTP_HOST', { infer: true }),
          port: config.get('SMTP_PORT', { infer: true }),
          startTls: config.get('SMTP_STARTTLS', { infer: true }),
          auth: config.get('SMTP_USER', { infer: true })
            ? {
                user: config.get('SMTP_USER', { infer: true }),
                pass: config.get('SMTP_PASSWORD', { infer: true }),
              }
            : undefined,
        }),
    },
    {
      provide: InvitationMail,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new InvitationMail(config.get('WEB_BASE_URL', { infer: true })),
    },
    PasswordResetMail,
    MailGateway,
    { provide: Mailing, useExisting: MailGateway },
    MailOutboxHandler,
  ],
  exports: [Mailing],
})
export class MailModule {}
