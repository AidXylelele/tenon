import { Injectable } from '@nestjs/common';
import { MailError, Mailer, SmtpTransport } from '@nestjs/mail';
import {
  NonRetryableMessageError,
  OnOutboxMessage,
  type OutboxHandlerContext,
} from '@nestjs/outbox';
import type { StoredMail } from '../interfaces.js';
import { OutboxMailTransport } from './outbox-mail.transport.js';

@Injectable()
export class MailOutboxHandler {
  constructor(
    private readonly mailer: Mailer,
    private readonly smtp: SmtpTransport,
  ) {}

  @OnOutboxMessage(OutboxMailTransport.TOPIC, { consumer: 'smtp' })
  async deliver(
    stored: StoredMail,
    { message, signal, attempt }: OutboxHandlerContext,
  ): Promise<void> {
    const mail = await this.mailer.render(stored);
    try {
      await this.smtp.send(mail, {
        signal,
        attempt,
        idempotencyKey: message.id,
      });
    } catch (error) {
      if (error instanceof MailError && error.permanent) {
        throw new NonRetryableMessageError(error.message, { cause: error });
      }

      throw error;
    }
  }
}
