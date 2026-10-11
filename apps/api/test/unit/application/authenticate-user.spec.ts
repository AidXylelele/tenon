import { AuthenticateUser } from '../../../src/application/use-cases/authenticate-user.js';
import {
  InvalidCredentialsError,
  UserSuspendedError,
} from '../../../src/domain/errors.js';
import type { User } from '../../../src/domain/user.js';
import { aUser, PASSWORD, passwords } from '../../support/builders.js';
import { InMemoryUserRepository } from '../../support/fakes.js';

const authenticateWith = (...users: User[]) =>
  new AuthenticateUser(new InMemoryUserRepository(...users), passwords);

describe('AuthenticateUser', () => {
  it('matching_credentials_yield_the_user', async () => {
    const user = await authenticateWith(aUser()).execute({
      email: 'user@example.com',
      password: PASSWORD,
    });
    expect(user.id).toBe('user-1');
  });

  it('the_email_is_matched_regardless_of_case', async () => {
    const user = await authenticateWith(aUser()).execute({
      email: 'User@Example.COM',
      password: PASSWORD,
    });
    expect(user.id).toBe('user-1');
  });

  it('a_wrong_password_and_an_unknown_email_are_refused_with_the_same_error', async () => {
    await expect(
      authenticateWith(aUser()).execute({
        email: 'user@example.com',
        password: 'not-the-password',
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(
      authenticateWith().execute({
        email: 'nobody@example.com',
        password: PASSWORD,
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('an_account_without_a_password_yet_is_refused_like_wrong_credentials', async () => {
    await expect(
      authenticateWith(aUser({ passwordHash: null })).execute({
        email: 'user@example.com',
        password: PASSWORD,
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('a_suspended_user_with_correct_credentials_is_refused_as_suspended', async () => {
    await expect(
      authenticateWith(aUser({ suspended: true })).execute({
        email: 'user@example.com',
        password: PASSWORD,
      }),
    ).rejects.toBeInstanceOf(UserSuspendedError);
  });
});
