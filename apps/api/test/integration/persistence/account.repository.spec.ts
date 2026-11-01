import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
  AccountRepository,
  UserRepository,
} from '../../../src/application/identity/ports.js';
import { Account } from '../../../src/domain/identity/account.js';
import { AccountType, Role } from '../../../src/domain/identity/enums.js';
import {
  StaleWriteError,
  AccountExistsError,
} from '../../../src/domain/errors.js';
import { User } from '../../../src/domain/identity/user.js';
import {
  account as accountTable,
  user as userTable,
} from '../../../src/interface-adapters/persistence/schema/index.js';
import { createTestApp, type TestApp } from '../../support/create-test-app.js';
import { inTransaction, truncateAll } from '../../support/db.js';

const now = new Date();

describe('DrizzleAccountRepository', () => {
  let t: TestApp;
  let repository: AccountRepository;
  let user: User;

  beforeAll(async () => {
    t = await createTestApp();
    repository = t.app.get(AccountRepository);
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateAll(t.db);
    user = User.create({
      email: 'user@example.com',
      name: 'User',
      role: Role.Viewer,
      now,
    });
    await inTransaction(t.app, () => t.app.get(UserRepository).add(user));
  });

  const save = (account: Account) =>
    inTransaction(t.app, () => repository.save(account));

  it('a_password_account_is_found_by_its_email_and_by_its_user', async () => {
    const account = Account.password(user, 'hash', now);
    await save(account);

    const email = 'user@example.com';
    const byEmail = await repository.findByEmail(email);
    expect(byEmail).toMatchObject({
      id: account.id,
      userId: user.id,
      type: AccountType.Password,
      identifier: 'user@example.com',
      passwordHash: 'hash',
      version: 1,
    });
    expect(
      (await repository.findByUserId(user.id, AccountType.Password))?.id,
    ).toBe(account.id);
  });

  it('an_account_of_another_type_is_not_found_by_the_email', async () => {
    const oidc = new Account({
      id: randomUUID(),
      userId: user.id,
      type: AccountType.Oidc,
      identifier: 'user@example.com',
      passwordHash: null,
      createdAt: now,
      updatedAt: now,
      version: 0,
    });
    await save(oidc);

    const email = 'user@example.com';
    expect(await repository.findByEmail(email)).toBeNull();
  });

  it('the_hash_lives_in_the_account_config_and_not_on_the_user', async () => {
    await save(Account.password(user, 'hash', now));
    const [row] = await t.db.select().from(accountTable);
    expect(row?.config).toEqual({ passwordHash: 'hash' });
    const [userRow] = await t.db.select().from(userTable);
    expect(Object.keys(userRow ?? {})).not.toContain('passwordHash');
  });

  it('a_second_password_account_for_the_same_user_is_refused', async () => {
    await save(Account.password(user, 'first', now));
    await expect(
      save(Account.password(user, 'second', now)),
    ).rejects.toBeInstanceOf(AccountExistsError);
  });

  it('a_second_save_of_a_new_account_is_refused_as_a_conflict', async () => {
    const account = Account.password(user, 'hash', now);
    await save(account);
    await expect(save(account)).rejects.toBeInstanceOf(StaleWriteError);
  });

  it('a_changed_password_is_read_back_and_a_stale_copy_is_refused_as_a_conflict', async () => {
    await save(Account.password(user, 'first', now));
    const current = await repository.findByUserId(
      user.id,
      AccountType.Password,
    );
    const stale = await repository.findByUserId(user.id, AccountType.Password);

    current!.changePassword('second', now);
    await save(current!);
    stale!.changePassword('third', now);
    await expect(save(stale!)).rejects.toBeInstanceOf(StaleWriteError);

    const stored = await repository.findByUserId(user.id, AccountType.Password);
    expect(stored).toMatchObject({ passwordHash: 'second', version: 2 });
  });

  it('the_accounts_go_with_their_user', async () => {
    await save(Account.password(user, 'hash', now));
    await t.db.delete(userTable).where(eq(userTable.id, user.id));
    expect(await t.db.select().from(accountTable)).toHaveLength(0);
  });
});
