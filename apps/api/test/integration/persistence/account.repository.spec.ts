import { eq } from "drizzle-orm";
import { AccountRepository } from "../../../src/application/identity/ports.js";
import { Account } from "../../../src/domain/identity/account.js";
import { Role } from "../../../src/domain/identity/enums.js";
import { StaleWriteError } from "../../../src/domain/errors.js";
import type { User } from "../../../src/domain/identity/user.js";
import {
  account as accountTable,
  user as userTable,
} from "../../../src/interface-adapters/persistence/schema/index.js";
import {
  accountRepository,
  addUser,
  createPersistenceTest,
  type PersistenceTest,
  truncateUsersAndDependents,
  userRepository,
} from "../../support/create-persistence-test.js";

const now = new Date();

describe("PostgresAccountRepository", () => {
  let t: PersistenceTest;
  let repository: AccountRepository;
  let user: User;

  beforeAll(async () => {
    const bindings = [...userRepository, ...accountRepository];
    t = await createPersistenceTest(bindings);
    repository = t.module.get(AccountRepository);
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateUsersAndDependents(t.db);
    user = await addUser(t, {
      email: "user@example.com",
      name: "User",
      role: Role.Viewer,
    });
  });

  const save = (account: Account) =>
    t.inTransaction(() => repository.save(account));

  it("a_password_account_is_found_by_its_email", async () => {
    const account = Account.password(user, "hash", now);
    await save(account);

    const found = await repository.findByEmail("user@example.com");

    const read = {
      id: found?.id,
      userId: found?.userId,
      identifier: found?.identifier,
      passwordHash: found?.passwordHash,
      version: found?.version,
    };
    expect(read).toEqual({
      id: account.id,
      userId: user.id,
      identifier: "user@example.com",
      passwordHash: "hash",
      version: 1,
    });
  });

  it("a_password_account_is_found_by_its_user", async () => {
    const account = Account.password(user, "hash", now);
    await save(account);

    const found = await repository.findByUserId(user.id);

    const foundId = found?.id;
    expect(foundId).toBe(account.id);
  });

  it("the_hash_lives_in_the_account_and_not_on_the_user", async () => {
    const account = Account.password(user, "hash", now);

    await save(account);

    const [row] = await t.db.select().from(accountTable);
    expect(row?.passwordHash).toBe("hash");
    const [userRow] = await t.db.select().from(userTable);
    expect(userRow).not.toHaveProperty("passwordHash");
  });

  it("a_second_password_account_for_the_same_user_is_refused", async () => {
    const first = Account.password(user, "first", now);
    await save(first);
    const second = Account.password(user, "second", now);

    const refused = save(second);

    await expect(refused).rejects.toBeInstanceOf(StaleWriteError);
  });

  it("a_second_save_of_a_new_account_is_refused_as_a_conflict", async () => {
    const account = Account.password(user, "hash", now);
    await save(account);

    const refused = save(account);

    await expect(refused).rejects.toBeInstanceOf(StaleWriteError);
  });

  it("a_changed_password_is_read_back_with_the_next_version", async () => {
    const account = Account.password(user, "first", now);
    await save(account);
    const current = await repository.findByUserId(user.id);
    assert.exists(current);
    current.changePassword("second", now);

    await save(current);

    const stored = await repository.findByUserId(user.id);
    const read = {
      passwordHash: stored?.passwordHash,
      version: stored?.version,
    };
    expect(read).toEqual({ passwordHash: "second", version: 2 });
  });

  it("a_stale_copy_of_an_account_is_refused_and_the_stored_password_stays", async () => {
    const account = Account.password(user, "first", now);
    await save(account);
    const current = await repository.findByUserId(user.id);
    const stale = await repository.findByUserId(user.id);
    assert.exists(current);
    assert.exists(stale);
    current.changePassword("second", now);
    await save(current);
    stale.changePassword("third", now);

    const refused = save(stale);

    await expect(refused).rejects.toBeInstanceOf(StaleWriteError);
    const stored = await repository.findByUserId(user.id);
    const read = {
      passwordHash: stored?.passwordHash,
      version: stored?.version,
    };
    expect(read).toEqual({ passwordHash: "second", version: 2 });
  });

  it("the_accounts_go_with_their_user", async () => {
    const account = Account.password(user, "hash", now);
    await save(account);

    await t.db.delete(userTable).where(eq(userTable.id, user.id));

    const rows = await t.db.select().from(accountTable);
    expect(rows).toHaveLength(0);
  });
});
