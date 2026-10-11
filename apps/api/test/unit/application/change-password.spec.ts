import { ChangePassword } from '../../../src/application/use-cases/change-password.js';
import {
  InvalidPasswordError,
  UserNotFoundError,
} from '../../../src/domain/errors.js';
import { aUser, PASSWORD, passwords } from '../../support/builders.js';
import { InMemoryUserRepository } from '../../support/fakes.js';

describe('ChangePassword', () => {
  it('the_correct_current_password_lets_the_new_one_replace_it', async () => {
    const users = new InMemoryUserRepository(aUser());
    await new ChangePassword(users, passwords).execute({
      userId: 'user-1',
      currentPassword: PASSWORD,
      newPassword: 'another-long-password',
    });
    const user = await users.getById('user-1');
    expect(
      await passwords.verify('another-long-password', user.passwordHash),
    ).toBe(true);
    expect(await passwords.verify(PASSWORD, user.passwordHash)).toBe(false);
  });

  it('a_wrong_current_password_is_refused_and_the_password_stays', async () => {
    const users = new InMemoryUserRepository(aUser());
    await expect(
      new ChangePassword(users, passwords).execute({
        userId: 'user-1',
        currentPassword: 'not-the-password',
        newPassword: 'another-long-password',
      }),
    ).rejects.toBeInstanceOf(InvalidPasswordError);
    const user = await users.getById('user-1');
    expect(await passwords.verify(PASSWORD, user.passwordHash)).toBe(true);
  });

  it('an_unknown_user_is_reported_as_not_found', async () => {
    await expect(
      new ChangePassword(new InMemoryUserRepository(), passwords).execute({
        userId: 'nobody',
        currentPassword: PASSWORD,
        newPassword: 'another-long-password',
      }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
