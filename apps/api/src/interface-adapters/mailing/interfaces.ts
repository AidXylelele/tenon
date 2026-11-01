import type { MailAddress } from '@nestjs/mail';
import type { Role } from '../../domain/identity/enums.js';
import type { InvitationToken } from '../../domain/identity/invitation-token.js';

export interface InvitationMailData {
  readonly token: InvitationToken;
  readonly inviterName: string;
  readonly role: Role;
  readonly expiresAt: Date;
}

export interface PasswordResetMailData {
  readonly link: string;
  readonly expiresAt: Date;
}

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
