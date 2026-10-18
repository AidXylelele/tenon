import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  type IdempotencyAcquireResult,
  IdempotencyStorage,
  type IdempotencyStore,
  type IdempotencyStoredPayload,
} from '@nestjs/idempotency';
import { and, eq, gt, lte } from 'drizzle-orm';
import { Database } from '../../interfaces.js';
import { idempotencyKey as keys } from '../schema/index.js';

@Injectable()
export class DrizzleIdempotencyStore implements IdempotencyStore {
  static readonly ROUNDS = 5;

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
    const keyHash = DrizzleIdempotencyStore.hash(key);

    for (let round = 0; round < DrizzleIdempotencyStore.ROUNDS; round++) {
      const now = Date.now();
      const lock = {
        key,
        fingerprint,
        owner,
        response: null,
        expiresAt: now + lockTtl,
      };
      const taken = await this.db
        .insert(keys)
        .values({ keyHash, ...lock })
        .onConflictDoUpdate({
          target: keys.keyHash,
          set: lock,
          setWhere: lte(keys.expiresAt, now),
        })
        .returning({ keyHash: keys.keyHash });

      if (taken.length > 0) return { state: 'acquired' };

      const [row] = await this.db
        .select()
        .from(keys)
        .where(eq(keys.keyHash, keyHash));
      const readAt = Date.now();

      if (!row || row.expiresAt <= readAt) continue;

      if (row.owner !== null) {
        return { state: 'in-flight', fingerprint: row.fingerprint };
      }

      return {
        state: 'completed',
        fingerprint: row.fingerprint,
        response: row.response as IdempotencyStoredPayload,
      };
    }

    throw new Error('The idempotency key kept expiring while it was read');
  }

  async complete(
    key: string,
    owner: string,
    response: IdempotencyStoredPayload,
    ttl: number,
  ): Promise<boolean> {
    const now = Date.now();
    const expiresAt = now + ttl;
    const held = this.heldBy(key, owner, now);
    const completed = await this.db
      .update(keys)
      .set({ owner: null, response, expiresAt })
      .where(held)
      .returning({ keyHash: keys.keyHash });
    return completed.length > 0;
  }

  async release(key: string, owner: string): Promise<boolean> {
    const now = Date.now();
    const held = this.heldBy(key, owner, now);
    const released = await this.db
      .delete(keys)
      .where(held)
      .returning({ keyHash: keys.keyHash });
    return released.length > 0;
  }

  async extend(key: string, owner: string, lockTtl: number): Promise<boolean> {
    const now = Date.now();
    const expiresAt = now + lockTtl;
    const held = this.heldBy(key, owner, now);
    const extended = await this.db
      .update(keys)
      .set({ expiresAt })
      .where(held)
      .returning({ keyHash: keys.keyHash });
    return extended.length > 0;
  }

  private heldBy(key: string, owner: string, now: number) {
    const keyHash = DrizzleIdempotencyStore.hash(key);
    return and(
      eq(keys.keyHash, keyHash),
      eq(keys.owner, owner),
      gt(keys.expiresAt, now),
    );
  }

  private static hash(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }
}
