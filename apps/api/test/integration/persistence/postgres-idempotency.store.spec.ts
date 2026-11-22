import { IdempotencyStorage } from "@nestjs/idempotency";
import { idempotencyStoreContract } from "@nestjs/idempotency/testing";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../../src/interface-adapters/persistence/schema/index.js";
import { PostgresIdempotencyStore } from "../../../src/interface-adapters/persistence/stores/postgres-idempotency.store.js";

const DAY_MS = 24 * 60 * 60 * 1_000;

describe("PostgresIdempotencyStore, the IdempotencyStore contract on a pool", () => {
  const db = drizzle({
    connection: { connectionString: process.env.DATABASE_URL, max: 20 },
    schema,
    casing: "snake_case",
  });
  const createStore = () =>
    new PostgresIdempotencyStore(db, new IdempotencyStorage());
  const cases = idempotencyStoreContract(createStore, {
    advanceTime: (ms) => {
      const later = Date.now() + ms;
      vi.setSystemTime(later);
    },
    concurrent: { callers: 32 },
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    await db.execute(sql`truncate table idempotency_key`);
    await db.$client.end();
  });

  for (const contractCase of cases) {
    it(contractCase.name, contractCase.run);
  }

  it("a_prune_deletes_the_expired_keys_and_keeps_the_live_ones", async () => {
    await db.execute(sql`truncate table idempotency_key`);
    const record = { fingerprint: "f", owner: null, response: null };
    const now = Date.now();
    await db.insert(schema.idempotencyKey).values([
      { ...record, keyHash: "expired", key: "expired", expiresAt: now - 1_000 },
      { ...record, keyHash: "live", key: "live", expiresAt: now + DAY_MS },
    ]);

    const pruned = await createStore().prune();
    const left = await db.execute(sql`select key from idempotency_key`);

    expect(pruned).toBe(1);
    expect(left.rows).toEqual([{ key: "live" }]);
  });
});
