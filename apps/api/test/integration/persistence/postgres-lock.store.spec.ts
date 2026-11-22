import { LocksStorage } from "@nestjs/locks";
import { lockStoreContract } from "@nestjs/locks/testing";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../../src/interface-adapters/persistence/schema/index.js";
import { PostgresLockStore } from "../../../src/interface-adapters/persistence/stores/postgres-lock.store.js";

describe("PostgresLockStore, the LockStore contract on a pool", () => {
  const db = drizzle({
    connection: { connectionString: process.env.DATABASE_URL, max: 20 },
    schema,
    casing: "snake_case",
  });
  const createStore = () => new PostgresLockStore(db, new LocksStorage());
  const cases = lockStoreContract(createStore, {
    concurrent: { callers: 32 },
  });

  afterAll(async () => {
    await db.execute(sql`truncate table lock`);
    await db.$client.end();
  });

  for (const contractCase of cases) {
    it(contractCase.name, contractCase.run);
  }

  it("a_keys_tokens_keep_growing_after_the_sequence_went_back", async () => {
    const store = createStore();
    const key = `restored-${String(Date.now())}`;
    await db.execute(sql`select setval('lock_fencing_token_seq', 1000)`);
    const before = await store.acquire(key, "a", 5_000);
    await store.release(key, "a");
    await db.execute(sql`alter sequence lock_fencing_token_seq restart with 1`);

    const after = await store.acquire(key, "b", 5_000);

    const first = before.acquired ? before.fencingToken : Infinity;
    const second = after.acquired ? after.fencingToken : -Infinity;
    expect(second).toBeGreaterThan(first);
  });
});
