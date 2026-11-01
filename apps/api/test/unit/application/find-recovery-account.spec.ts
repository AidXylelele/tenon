import { FindRecoveryAccount } from '../../../src/application/identity/find-recovery-account.js';
import { UserStatus } from '../../../src/domain/identity/enums.js';
import { aPasswordAccount, aUser } from '../../support/builders.js';
import {
  InMemoryAccountRepository,
  InMemoryUserRepository,
} from '../../support/fakes.js';

describe('FindRecoveryAccount', () => {
  it('an_active_user_can_recover_the_password_of_their_account', async () => {
    const user = aUser();
    const account = aPasswordAccount(user);
    const found = await new FindRecoveryAccount(
      new InMemoryUserRepository(user),
      new InMemoryAccountRepository(account),
    ).execute('user@example.com');
    expect(found).toEqual({ user, account });
  });

  it('a_suspended_or_unknown_user_cannot_recover_a_password', async () => {
    const suspended = aUser({ status: UserStatus.Suspended });
    const find = new FindRecoveryAccount(
      new InMemoryUserRepository(suspended),
      new InMemoryAccountRepository(aPasswordAccount(suspended)),
    );
    expect(await find.execute('user@example.com')).toBeNull();
    expect(await find.execute('nobody@example.com')).toBeNull();
  });
});
