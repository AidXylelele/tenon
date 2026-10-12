import { AuthenticateUser } from '../../../src/application/use-cases/authenticate-user.js';
import type { Account } from '../../../src/domain/account.js';
import { UserStatus } from '../../../src/domain/enums.js';
import {
  InvalidCredentialsError,
  UserSuspendedError,
} from '../../../src/domain/errors.js';
import type { User } from '../../../src/domain/user.js';
import {
  aPasswordAccount,
  aUser,
  PASSWORD,
  passwords,
} from '../../support/builders.js';
import {
  InMemoryAccountRepository,
  InMemoryUserRepository,
} from '../../support/fakes.js';

const authenticateWith = (user: User, ...accounts: Account[]) =>
  new AuthenticateUser(
    new InMemoryAccountRepository(...accounts),
    new InMemoryUserRepository(user),
    passwords,
  );

describe('AuthenticateUser', () => {
  it('matching_credentials_yield_the_user', async () => {
    const user = aUser();
    const authenticated = await authenticateWith(
      user,
      aPasswordAccount(user),
    ).execute({ email: 'user@example.com', password: PASSWORD });
    expect(authenticated).toBe(user);
  });

  it('a_wrong_password_and_an_unknown_email_are_refused_with_the_same_error', async () => {
    const user = aUser();
    const authenticate = authenticateWith(user, aPasswordAccount(user));
    await expect(
      authenticate.execute({
        email: 'user@example.com',
        password: 'not-the-password',
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(
      authenticate.execute({ email: 'nobody@example.com', password: PASSWORD }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('a_user_without_a_password_account_is_refused_like_wrong_credentials', async () => {
    await expect(
      authenticateWith(aUser()).execute({
        email: 'user@example.com',
        password: PASSWORD,
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('a_suspended_user_with_correct_credentials_is_refused_as_suspended', async () => {
    const user = aUser({ status: UserStatus.Suspended });
    await expect(
      authenticateWith(user, aPasswordAccount(user)).execute({
        email: 'user@example.com',
        password: PASSWORD,
      }),
    ).rejects.toBeInstanceOf(UserSuspendedError);
  });
});
