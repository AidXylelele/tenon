import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import {
  type MailMessage,
  MailTransport,
  type MailTransportResult,
} from '@nestjs/mail';
import { Outbox } from '@nestjs/outbox';
import type { DrizzleTx, StoredMail } from '../interfaces.js';

@Injectable()
export class OutboxMailTransport extends MailTransport {
  static readonly TOPIC = 'mail';

  constructor(
    private readonly outbox: Outbox,
    private readonly txHost: TransactionHost<DrizzleTx>,
  ) {
    super();
  }

  async send(message: MailMessage): Promise<MailTransportResult> {
    const payload: StoredMail = {
      from: message.from,
      replyTo: [...message.replyTo],
      to: [...message.to],
      cc: [...message.cc],
      bcc: [...message.bcc],
      subject: message.subject,
      html: message.html,
      text: message.text,
      headers: { ...message.headers },
    };
    await this.txHost.withTransaction(async () => {
      await this.outbox.add(this.txHost.tx, {
        topic: OutboxMailTransport.TOPIC,
        key: message.messageId,
        payload,
      });
    });
    return { accepted: message.envelope.to };
  }
}
