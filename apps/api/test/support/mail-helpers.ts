import type { SentMail } from '@nestjs/mail';
import type { TestApp } from './create-test-app.js';

export async function invitationTokenFor(
  t: TestApp,
  email: string,
): Promise<string> {
  await t.deliverOutbox();
  return tokenIn(deliveredTo(t, email), '/invitations/accept');
}

export async function recoveryTokenFor(
  t: TestApp,
  email: string,
): Promise<string> {
  await t.settle();
  await t.deliverOutbox();
  return tokenIn(deliveredTo(t, email), '/reset-password');
}

const deliveredTo = (t: TestApp, email: string): SentMail => {
  const mail = t.mail.lastTo(email);

  if (!mail) throw new Error(`No mail was delivered to ${email}`);

  return mail;
};

const tokenIn = (mail: SentMail, path: string): string =>
  mail.link(path).searchParams.get('token') ?? '';
