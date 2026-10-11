import {
  AuthenticationStorage,
  type EmailTokenPurpose,
  type EmailTokenRecord,
  type EmailTokenStore,
} from '@nestjs/authentication';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, eq } from 'drizzle-orm';
import type { DrizzleTx } from '../../interfaces.js';
import { emailToken as tokens } from '../../persistence/schema/index.js';

@Injectable()
export class DrizzleEmailTokenStore implements EmailTokenStore {
  constructor(
    private readonly txHost: TransactionHost<DrizzleTx>,
    storage: AuthenticationStorage,
  ) {
    storage.registerSource({ emailTokens: this });
  }

  async saveEmailToken(record: EmailTokenRecord): Promise<void> {
    await this.txHost.tx.insert(tokens).values({
      id: record.id,
      purpose: record.purpose,
      userId: record.userId,
      email: record.email,
      fingerprint: record.fingerprint ?? null,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
    });
  }

  async consumeEmailToken(
    id: string,
    purpose: EmailTokenPurpose,
  ): Promise<EmailTokenRecord | undefined> {
    const [row] = await this.txHost.tx
      .delete(tokens)
      .where(and(eq(tokens.id, id), eq(tokens.purpose, purpose)))
      .returning();

    if (!row) return undefined;

    return {
      id: row.id,
      purpose: row.purpose as EmailTokenPurpose,
      userId: row.userId,
      email: row.email,
      fingerprint: row.fingerprint ?? undefined,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    };
  }

  async deleteUserEmailTokens(
    userId: string,
    purpose: EmailTokenPurpose,
  ): Promise<void> {
    await this.txHost.tx
      .delete(tokens)
      .where(and(eq(tokens.userId, userId), eq(tokens.purpose, purpose)));
  }
}
