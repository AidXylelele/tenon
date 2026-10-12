import { ResetPassword } from '../../../src/application/use-cases/reset-password.js';
import { AccountType } from '../../../src/domain/enums.js';
import { UserNotFoundError } from '../../../src/domain/errors.js';
import { aPasswordAccount, aUser } from '../../support/builders.js';
import {
  InMemoryAccountRepository,
  InMemoryUserRepository,
} from '../../support/fakes.js';

describe('ResetPassword', () => {
  it('the_new_hash_replaces_the_password_of_the_existing_account', async () => {
    const account = aPasswordAccount(aUser(), 'old-hash');
    const accounts = new InMemoryAccountRepository(account);
    await new ResetPassword(accounts, new InMemoryUserRepository()).execute({
      userId: 'user-1',
      passwordHash: 'new-hash',
    });
    expect(account.passwordHash).toBe('new-hash');
    expect(accounts.accounts.size).toBe(1);
  });

  it('a_user_without_a_password_gets_a_password_account', async () => {
    const accounts = new InMemoryAccountRepository();
    await new ResetPassword(
      accounts,
      new InMemoryUserRepository(aUser({ email: 'admin@example.com' })),
    ).execute({ userId: 'user-1', passwordHash: 'first-hash' });
    expect(
      await accounts.findByUserId('user-1', AccountType.Password),
    ).toMatchObject({
      identifier: 'admin@example.com',
      passwordHash: 'first-hash',
    });
  });

  it('an_unknown_user_is_reported_as_not_found', async () => {
    await expect(
      new ResetPassword(
        new InMemoryAccountRepository(),
        new InMemoryUserRepository(),
      ).execute({ userId: 'nobody', passwordHash: 'hash' }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
