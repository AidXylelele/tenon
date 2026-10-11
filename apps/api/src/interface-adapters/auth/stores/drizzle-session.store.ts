import {
  AuthenticationStorage,
  type SessionRecord,
  type SessionStore,
} from '@nestjs/authentication';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { eq } from 'drizzle-orm';
import type { DrizzleTx } from '../../interfaces.js';
import { session as sessions } from '../../persistence/schema/index.js';

@Injectable()
export class DrizzleSessionStore implements SessionStore {
  constructor(
    private readonly txHost: TransactionHost<DrizzleTx>,
    storage: AuthenticationStorage,
  ) {
    storage.registerSource({ sessions: this });
  }

  async getSession(id: string): Promise<SessionRecord | undefined> {
    const [row] = await this.txHost.tx
      .select()
      .from(sessions)
      .where(eq(sessions.id, id));

    if (!row) return undefined;

    return this.toRecord(row);
  }

  async createSession(record: SessionRecord): Promise<void> {
    await this.txHost.tx.insert(sessions).values({
      id: record.id,
      userId: record.userId,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      lastActiveAt: record.lastActiveAt,
      mfa: record.mfa ?? null,
      metadata: record.metadata ?? null,
    });
  }

  async touchSession(id: string, lastActiveAt: Date): Promise<void> {
    await this.txHost.tx
      .update(sessions)
      .set({ lastActiveAt })
      .where(eq(sessions.id, id));
  }

  async deleteSession(id: string): Promise<boolean> {
    const deleted = await this.txHost.tx
      .delete(sessions)
      .where(eq(sessions.id, id))
      .returning({ id: sessions.id });
    return deleted.length > 0;
  }

  async listUserSessions(userId: string): Promise<SessionRecord[]> {
    const rows = await this.txHost.tx
      .select()
      .from(sessions)
      .where(eq(sessions.userId, userId));
    return rows.map((row) => this.toRecord(row));
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await this.txHost.tx.delete(sessions).where(eq(sessions.userId, userId));
  }

  private toRecord(row: typeof sessions.$inferSelect): SessionRecord {
    return {
      id: row.id,
      userId: row.userId,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      lastActiveAt: row.lastActiveAt,
      mfa: row.mfa ?? undefined,
      metadata: row.metadata ?? undefined,
    };
  }
}
