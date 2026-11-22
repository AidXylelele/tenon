import {
  AuthenticationStorage,
  type SessionRecord,
} from "@nestjs/authentication";
import { Role } from "../../../src/domain/identity/enums.js";
import { PostgresSessionStore } from "../../../src/interface-adapters/persistence/stores/postgres-session.store.js";
import {
  addUser,
  createPersistenceTest,
  type PersistenceTest,
  truncateUsersAndDependents,
  userRepository,
} from "../../support/create-persistence-test.js";

const CREATED = new Date("2026-11-22T10:00:00.000Z");
const EXPIRED = new Date("2026-11-22T10:00:01.000Z");
const SAVED = new Date("2026-11-22T10:01:00.000Z");
const LIVE = new Date("2026-11-22T11:00:00.000Z");

describe("PostgresSessionStore", () => {
  let t: PersistenceTest;
  let store: PostgresSessionStore;

  beforeAll(async () => {
    const storage = new AuthenticationStorage();
    const bindings = [
      ...userRepository,
      PostgresSessionStore,
      { provide: AuthenticationStorage, useValue: storage },
    ];
    t = await createPersistenceTest(bindings);
    store = t.module.get(PostgresSessionStore);
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateUsersAndDependents(t.db);
  });

  it("a_new_session_deletes_the_expired_ones_and_keeps_the_live_ones", async () => {
    const user = await addUser(t, {
      email: "user@example.com",
      name: "User",
      role: Role.Viewer,
    });
    const expired: SessionRecord = {
      id: "expired",
      userId: user.id,
      createdAt: CREATED,
      expiresAt: EXPIRED,
      lastActiveAt: CREATED,
    };
    const live: SessionRecord = {
      id: "live",
      userId: user.id,
      createdAt: CREATED,
      expiresAt: LIVE,
      lastActiveAt: CREATED,
    };
    const saved: SessionRecord = {
      id: "saved",
      userId: user.id,
      createdAt: SAVED,
      expiresAt: LIVE,
      lastActiveAt: SAVED,
    };

    await store.createSession(expired);
    await store.createSession(live);
    await store.createSession(saved);
    const left = await store.listUserSessions(user.id);

    const ids = left.map((session) => session.id).toSorted();
    expect(ids).toEqual(["live", "saved"]);
  });
});
