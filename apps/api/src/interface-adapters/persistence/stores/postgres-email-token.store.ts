import {
  AuthenticationStorage,
  type EmailTokenPurpose,
  type EmailTokenRecord,
  type EmailTokenStore,
} from "@nestjs/authentication";
import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { and, desc, eq, lte } from "drizzle-orm";
import type { Transaction } from "../interfaces.js";
import { emailToken as tokens } from "../schema/index.js";

@Injectable()
export class PostgresEmailTokenStore implements EmailTokenStore {
  private static readonly MOST_PENDING = 100_000;

  constructor(
    private readonly txHost: TransactionHost<Transaction>,
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
    await this.trim(record.createdAt);
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

  private async trim(now: Date): Promise<void> {
    await this.txHost.tx.delete(tokens).where(lte(tokens.expiresAt, now));
    const [cutoff] = await this.txHost.tx
      .select({ expiresAt: tokens.expiresAt })
      .from(tokens)
      .orderBy(desc(tokens.expiresAt))
      .limit(1)
      .offset(PostgresEmailTokenStore.MOST_PENDING);

    if (!cutoff) return;

    await this.txHost.tx
      .delete(tokens)
      .where(lte(tokens.expiresAt, cutoff.expiresAt));
  }
}
