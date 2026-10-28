import type { MailAddress } from '@nestjs/mail';

export interface StoredMail {
  readonly from: MailAddress;
  readonly replyTo: MailAddress[];
  readonly to: MailAddress[];
  readonly cc: MailAddress[];
  readonly bcc: MailAddress[];
  readonly subject: string;
  readonly html?: string;
  readonly text?: string;
  readonly headers: Record<string, string>;
}
