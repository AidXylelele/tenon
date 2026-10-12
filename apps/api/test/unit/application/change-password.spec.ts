import { ChangePassword } from '../../../src/application/use-cases/change-password.js';
import { InvalidPasswordError } from '../../../src/domain/errors.js';
import {
  aPasswordAccount,
  PASSWORD,
  passwords,
} from '../../support/builders.js';
import { InMemoryAccountRepository } from '../../support/fakes.js';

describe('ChangePassword', () => {
  it('the_correct_current_password_lets_the_new_one_replace_it', async () => {
    const account = aPasswordAccount();
    await new ChangePassword(
      new InMemoryAccountRepository(account),
      passwords,
    ).execute({
      userId: 'user-1',
      currentPassword: PASSWORD,
      newPassword: 'another-long-password',
    });
    expect(
      await passwords.verify('another-long-password', account.passwordHash),
    ).toBe(true);
    expect(await passwords.verify(PASSWORD, account.passwordHash)).toBe(false);
  });

  it('a_wrong_current_password_is_refused_and_the_password_stays', async () => {
    const account = aPasswordAccount();
    await expect(
      new ChangePassword(
        new InMemoryAccountRepository(account),
        passwords,
      ).execute({
        userId: 'user-1',
        currentPassword: 'not-the-password',
        newPassword: 'another-long-password',
      }),
    ).rejects.toBeInstanceOf(InvalidPasswordError);
    expect(await passwords.verify(PASSWORD, account.passwordHash)).toBe(true);
  });

  it('a_user_without_a_password_account_is_refused_as_a_wrong_password', async () => {
    await expect(
      new ChangePassword(new InMemoryAccountRepository(), passwords).execute({
        userId: 'user-1',
        currentPassword: PASSWORD,
        newPassword: 'another-long-password',
      }),
    ).rejects.toBeInstanceOf(InvalidPasswordError);
  });
});
