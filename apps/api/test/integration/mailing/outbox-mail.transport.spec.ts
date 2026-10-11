import { Mailer } from '@nestjs/mail';
import { TransactionHost } from '@nestjs-cls/transactional';
import { PasswordResetMail } from '../../../src/interface-adapters/mailing/templates/password-reset.mail.js';
import { createTestApp, type TestApp } from '../../support/create-test-app.js';
import { queuedMailCount, truncateAll } from '../../support/db.js';

describe('OutboxMailTransport', () => {
  let t: TestApp;
  let mailer: Mailer;
  let txHost: TransactionHost;

  beforeAll(async () => {
    t = await createTestApp();
    mailer = t.app.get(Mailer);
    txHost = t.app.get(TransactionHost);
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateAll(t.db);
    t.mail.clear();
  });

  const send = () =>
    mailer.send(PasswordResetMail, {
      to: 'user@example.com',
      data: {
        to: 'user@example.com',
        link: 'http://127.0.0.1:3001/reset-password?token=abc',
        expiresAt: new Date('2026-10-11T11:00:00.000Z'),
      },
    });

  it('a_mail_sent_in_a_transaction_that_rolls_back_is_neither_queued_nor_delivered', async () => {
    await expect(
      txHost.withTransaction(async () => {
        await send();
        throw new Error('rolled back');
      }),
    ).rejects.toThrow('rolled back');
    expect(await queuedMailCount(t.db)).toBe(0);
    await t.deliverOutbox();
    expect(t.mail.mails).toHaveLength(0);
  });

  it('a_mail_sent_in_a_committed_transaction_is_queued_and_delivered_by_the_relay', async () => {
    await txHost.withTransaction(send);
    expect(await queuedMailCount(t.db)).toBe(1);
    expect(t.mail.mails).toHaveLength(0);
    await t.deliverOutbox();
    const delivered = t.mail.lastTo('user@example.com');
    expect(delivered?.subject).toContain('Reset');
    expect(delivered?.text).toContain('reset-password?token=abc');
  });

  it('a_mail_sent_outside_a_transaction_is_queued_as_well', async () => {
    await send();
    expect(await queuedMailCount(t.db)).toBe(1);
  });

  it('a_failed_delivery_keeps_the_message_queued_for_a_retry', async () => {
    t.mail.failNext(new Error('smtp unavailable'));
    await send();
    await t.deliverOutbox();
    expect(t.mail.mails).toHaveLength(0);
    expect(await queuedMailCount(t.db)).toBe(1);
  });
});
