import { InMemoryMailTransport, type SentMail } from '@nestjs/mail';

export class Mailbox extends InMemoryMailTransport {
  lastTo(email: string): SentMail | null {
    return this.filter({ to: email }).at(-1) ?? null;
  }
}
