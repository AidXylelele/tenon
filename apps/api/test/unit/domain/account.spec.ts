import { Account } from '../../../src/domain/account.js';
import { AccountType } from '../../../src/domain/enums.js';
import { AccountWithoutPasswordError } from '../../../src/domain/errors.js';
import { aPasswordAccount, aUser } from '../../support/builders.js';

describe('Account', () => {
  it('a_password_account_belongs_to_the_user_and_is_identified_by_their_email', () => {
    const user = aUser({ email: 'user@example.com' });
    const account = Account.password(user, 'first');
    expect(account.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(account).toMatchObject({
      userId: user.id,
      type: AccountType.Password,
      identifier: 'user@example.com',
      passwordHash: 'first',
      version: 1,
    });
  });

  it('changing_the_password_replaces_the_stored_hash', () => {
    const account = aPasswordAccount(aUser(), 'first');
    account.changePassword('second');
    expect(account.passwordHash).toBe('second');
  });

  it('an_account_without_a_password_refuses_a_password_change', () => {
    const account = new Account({
      id: 'account-1',
      userId: 'user-1',
      type: AccountType.Oidc,
      identifier: 'https://issuer.example.com|subject-1',
      passwordHash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    });
    expect(() => account.changePassword('hash')).toThrow(
      AccountWithoutPasswordError,
    );
    expect(account.passwordHash).toBeNull();
  });
});
