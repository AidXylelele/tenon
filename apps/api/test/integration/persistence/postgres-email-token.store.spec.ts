import {
  AuthenticationStorage,
  type EmailTokenRecord,
} from "@nestjs/authentication";
import { sql } from "drizzle-orm";
import { Role } from "../../../src/domain/identity/enums.js";
import { PostgresEmailTokenStore } from "../../../src/interface-adapters/persistence/stores/postgres-email-token.store.js";
import {
  addUser,
  createPersistenceTest,
  type PersistenceTest,
  truncateUsersAndDependents,
  userRepository,
} from "../../support/create-persistence-test.js";

const EMAIL = "user@example.com";
const RESET = "password-reset";
const MOST_PENDING = 100_000;

const CREATED = new Date("2026-11-22T10:00:00.000Z");
const EXPIRED = new Date("2026-11-22T10:00:01.000Z");
const SAVED = new Date("2026-11-22T10:01:00.000Z");
const LIVE = new Date("2026-11-22T11:00:00.000Z");
const LAST = new Date("2026-12-31T00:00:00.000Z");

describe("PostgresEmailTokenStore", () => {
  let t: PersistenceTest;
  let store: PostgresEmailTokenStore;
  let userId: string;

  beforeAll(async () => {
    const storage = new AuthenticationStorage();
    const bindings = [
      ...userRepository,
      PostgresEmailTokenStore,
      { provide: AuthenticationStorage, useValue: storage },
    ];
    t = await createPersistenceTest(bindings);
    store = t.module.get(PostgresEmailTokenStore);
  });

  afterAll(async () => {
    await truncateUsersAndDependents(t.db);
    await t.close();
  });

  beforeEach(async () => {
    await truncateUsersAndDependents(t.db);
    const user = await addUser(t, {
      email: EMAIL,
      name: "User",
      role: Role.Viewer,
    });
    userId = user.id;
  });

  it("a_new_token_deletes_the_expired_ones_and_keeps_the_live_ones", async () => {
    const expired: EmailTokenRecord = {
      id: "expired",
      purpose: RESET,
      userId,
      email: EMAIL,
      createdAt: CREATED,
      expiresAt: EXPIRED,
    };
    const live: EmailTokenRecord = {
      id: "live",
      purpose: RESET,
      userId,
      email: EMAIL,
      createdAt: CREATED,
      expiresAt: LIVE,
    };
    const saved: EmailTokenRecord = {
      id: "saved",
      purpose: RESET,
      userId,
      email: EMAIL,
      createdAt: SAVED,
      expiresAt: LIVE,
    };

    await store.saveEmailToken(expired);
    await store.saveEmailToken(live);
    await store.saveEmailToken(saved);
    const pruned = await store.consumeEmailToken(expired.id, RESET);
    const kept = await store.consumeEmailToken(live.id, RESET);

    expect(pruned).toBeUndefined();
    expect(kept).toEqual(live);
  });

  it("a_new_token_past_the_most_pending_deletes_the_one_that_expires_first", async () => {
    await t.db.execute(sql`
      insert into email_token (id, purpose, user_id, email, created_at, expires_at)
      select 'pending-' || n, ${RESET}, ${userId}, ${EMAIL}, ${CREATED}, ${CREATED}::timestamptz + n * interval '1 second'
      from generate_series(1, ${MOST_PENDING}) as n
    `);
    const last: EmailTokenRecord = {
      id: "last",
      purpose: RESET,
      userId,
      email: EMAIL,
      createdAt: CREATED,
      expiresAt: LAST,
    };

    await store.saveEmailToken(last);
    const first = await store.consumeEmailToken("pending-1", RESET);
    const second = await store.consumeEmailToken("pending-2", RESET);
    const kept = await store.consumeEmailToken(last.id, RESET);

    expect(first).toBeUndefined();
    expect(second?.id).toBe("pending-2");
    expect(kept).toEqual(last);
  });
});
