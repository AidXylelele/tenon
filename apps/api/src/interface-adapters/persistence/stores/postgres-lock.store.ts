import { Injectable } from "@nestjs/common";
import { InjectDrizzle } from "@nestjs/drizzle";
import {
  type LockAcquireResult,
  LocksStorage,
  type LockStore,
} from "@nestjs/locks";
import { and, eq, gt, type SQL, sql } from "drizzle-orm";
import type { Database } from "../interfaces.js";
import { lock as locks } from "../schema/index.js";

@Injectable()
export class PostgresLockStore implements LockStore {
  constructor(
    @InjectDrizzle() private readonly db: Database,
    storage: LocksStorage,
  ) {
    storage.registerSource(this);
  }

  async acquire(
    key: string,
    owner: string,
    ttl: number,
  ): Promise<LockAcquireResult> {
    const expiresAt = this.expiresIn(ttl);
    const [row] = await this.db
      .insert(locks)
      .values({
        key,
        owner,
        fencingToken: sql`nextval('lock_fencing_token_seq')`,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: locks.key,
        set: {
          owner,
          fencingToken: sql`greatest(nextval('lock_fencing_token_seq'), ${locks.fencingToken} + 1)`,
          expiresAt,
        },
        setWhere: sql`${locks.owner} is null or ${locks.expiresAt} <= clock_timestamp()`,
      })
      .returning({ fencingToken: locks.fencingToken });

    if (row === undefined) return { acquired: false };

    return { acquired: true, fencingToken: row.fencingToken };
  }

  async renew(key: string, owner: string, ttl: number): Promise<boolean> {
    const expiresAt = this.expiresIn(ttl);
    const held = this.heldBy(key, owner);
    const renewed = await this.db
      .update(locks)
      .set({ expiresAt })
      .where(held)
      .returning({ key: locks.key });
    return renewed.length === 1;
  }

  async release(key: string, owner: string): Promise<boolean> {
    const held = this.heldBy(key, owner);
    const released = await this.db
      .update(locks)
      .set({ owner: null })
      .where(held)
      .returning({ key: locks.key });
    return released.length === 1;
  }

  private expiresIn(ttl: number): SQL {
    return sql`clock_timestamp() + ${ttl} * interval '1 millisecond'`;
  }

  private heldBy(key: string, owner: string): SQL | undefined {
    return and(
      eq(locks.key, key),
      eq(locks.owner, owner),
      gt(locks.expiresAt, sql`clock_timestamp()`),
    );
  }
}
