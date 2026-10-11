import type { TransactionalAdapterDrizzleOrm } from '@nestjs-cls/transactional-adapter-drizzle-orm';
import type { MailAddress } from '@nestjs/mail';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { User } from '../domain/user.js';
import type * as schema from './persistence/schema/index.js';

export abstract class Database extends NodePgDatabase<typeof schema> {}

export type DrizzleTx = TransactionalAdapterDrizzleOrm<Database>;

export type UserRow = typeof schema.user.$inferSelect;

export type InvitationRow = typeof schema.invitation.$inferSelect;

declare module '@nestjs/authentication' {
  interface AuthenticationTypes {
    user: User;
  }
}

export interface PasswordResetEmail {
  readonly to: string;
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
