import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  type IdempotencyAcquireResult,
  IdempotencyStorage,
  type IdempotencyStore,
  type IdempotencyStoredPayload,
} from '@nestjs/idempotency';
import { and, eq, gt, lte } from 'drizzle-orm';
import { Database } from '../interfaces.js';
import { idempotencyKey as records } from '../schema/index.js';

const ACQUIRE_ATTEMPTS = 5;

@Injectable()
export class DrizzleIdempotencyStore implements IdempotencyStore {
  constructor(
    private readonly db: Database,
    storage: IdempotencyStorage,
  ) {
    storage.registerSource(this);
  }

  async acquire(
    key: string,
    owner: string,
    fingerprint: string,
    lockTtl: number,
  ): Promise<IdempotencyAcquireResult> {
    const keyHash = hashOf(key);

    for (let attempt = 0; attempt < ACQUIRE_ATTEMPTS; attempt++) {
      const now = Date.now();
      const expiresAt = now + lockTtl;
      const taken = await this.db
        .insert(records)
        .values({ keyHash, key, fingerprint, owner, response: null, expiresAt })
        .onConflictDoUpdate({
          target: records.keyHash,
          set: { fingerprint, owner, response: null, expiresAt },
          setWhere: lte(records.expiresAt, now),
        })
        .returning({ keyHash: records.keyHash });

      if (taken.length > 0) return { state: 'acquired' };

      const [held] = await this.db
        .select()
        .from(records)
        .where(eq(records.keyHash, keyHash));

      if (held && held.expiresAt > now) return this.toResult(held);
    }

    throw new Error('The idempotency record kept changing; try again');
  }

  async complete(
    key: string,
    owner: string,
    response: IdempotencyStoredPayload,
    ttl: number,
  ): Promise<boolean> {
    const now = Date.now();
    const completed = await this.db
      .update(records)
      .set({ owner: null, response, expiresAt: now + ttl })
      .where(this.ownedBy(key, owner, now))
      .returning({ keyHash: records.keyHash });
    return completed.length === 1;
  }

  async release(key: string, owner: string): Promise<boolean> {
    const now = Date.now();
    const released = await this.db
      .delete(records)
      .where(this.ownedBy(key, owner, now))
      .returning({ keyHash: records.keyHash });
    return released.length === 1;
  }

  async extend(key: string, owner: string, lockTtl: number): Promise<boolean> {
    const now = Date.now();
    const extended = await this.db
      .update(records)
      .set({ expiresAt: now + lockTtl })
      .where(this.ownedBy(key, owner, now))
      .returning({ keyHash: records.keyHash });
    return extended.length === 1;
  }

  private ownedBy(key: string, owner: string, now: number) {
    return and(
      eq(records.keyHash, hashOf(key)),
      eq(records.owner, owner),
      gt(records.expiresAt, now),
    );
  }

  private toResult(
    held: typeof records.$inferSelect,
  ): IdempotencyAcquireResult {
    if (held.response === null) {
      return { state: 'in-flight', fingerprint: held.fingerprint };
    }

    return {
      state: 'completed',
      fingerprint: held.fingerprint,
      response: held.response,
    };
  }
}

function hashOf(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}
