import { eq } from 'drizzle-orm';
import {
  AccountRepository,
  UserRepository,
} from '../../../src/application/interfaces.js';
import { Account } from '../../../src/domain/account.js';
import { AccountType, Role } from '../../../src/domain/enums.js';
import {
  AccountConflictError,
  AccountExistsError,
} from '../../../src/domain/errors.js';
import { User } from '../../../src/domain/user.js';
import {
  account as accountTable,
  user as userTable,
} from '../../../src/interface-adapters/persistence/schema/index.js';
import { createTestApp, type TestApp } from '../../support/create-test-app.js';
import { truncateAll } from '../../support/db.js';

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
    });
    await t.app.get(UserRepository).add(user);
  });

  it('a_password_account_is_found_by_its_email_and_by_its_user', async () => {
    const account = Account.password(user, 'hash');
    await repository.add(account);

    const byIdentifier = await repository.findByIdentifier(
      AccountType.Password,
      'user@example.com',
    );
    expect(byIdentifier).toMatchObject({
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
    expect(
      await repository.findByIdentifier(AccountType.Oidc, 'user@example.com'),
    ).toBeNull();
  });

  it('the_hash_lives_in_the_account_config_and_not_on_the_user', async () => {
    await repository.add(Account.password(user, 'hash'));
    const [row] = await t.db.select().from(accountTable);
    expect(row?.config).toEqual({ passwordHash: 'hash' });
    const [userRow] = await t.db.select().from(userTable);
    expect(Object.keys(userRow ?? {})).not.toContain('passwordHash');
  });

  it('a_second_password_account_for_the_same_user_is_refused', async () => {
    await repository.add(Account.password(user, 'first'));
    await expect(
      repository.add(Account.password(user, 'second')),
    ).rejects.toBeInstanceOf(AccountExistsError);
  });

  it('a_changed_password_is_read_back_and_a_stale_copy_is_refused_as_a_conflict', async () => {
    await repository.add(Account.password(user, 'first'));
    const current = await repository.findByUserId(
      user.id,
      AccountType.Password,
    );
    const stale = await repository.findByUserId(user.id, AccountType.Password);

    current!.changePassword('second');
    await repository.update(current!);
    stale!.changePassword('third');
    await expect(repository.update(stale!)).rejects.toBeInstanceOf(
      AccountConflictError,
    );

    const stored = await repository.findByUserId(user.id, AccountType.Password);
    expect(stored).toMatchObject({ passwordHash: 'second', version: 2 });
  });

  it('the_accounts_go_with_their_user', async () => {
    await repository.add(Account.password(user, 'hash'));
    await t.db.delete(userTable).where(eq(userTable.id, user.id));
    expect(await t.db.select().from(accountTable)).toHaveLength(0);
  });
});
