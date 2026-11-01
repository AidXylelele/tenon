import { ChangePassword } from '../../../src/application/identity/change-password.js';
import { InvalidPasswordError } from '../../../src/domain/errors.js';
import {
  aPasswordAccount,
  PASSWORD,
  passwords,
} from '../../support/builders.js';
import {
  InMemoryAccountRepository,
  RecordingSessions,
} from '../../support/fakes.js';

describe('ChangePassword', () => {
  it('the_correct_current_password_lets_the_new_one_replace_it', async () => {
    const account = aPasswordAccount();
    await new ChangePassword(
      new InMemoryAccountRepository(account),
      passwords,
      new RecordingSessions(),
    ).execute({
      userId: 'user-1',
      sessionId: 'session-1',
      currentPassword: PASSWORD,
      newPassword: 'another-long-password',
    });
    expect(
      await passwords.verify('another-long-password', account.passwordHash),
    ).toBe(true);
    expect(await passwords.verify(PASSWORD, account.passwordHash)).toBe(false);
  });

  it('a_new_password_ends_every_other_session_of_the_user', async () => {
    const sessions = new RecordingSessions();
    await new ChangePassword(
      new InMemoryAccountRepository(aPasswordAccount()),
      passwords,
      sessions,
    ).execute({
      userId: 'user-1',
      sessionId: 'session-1',
      currentPassword: PASSWORD,
      newPassword: 'another-long-password',
    });
    expect(sessions.ended).toEqual([{ userId: 'user-1', except: 'session-1' }]);
  });

  it('a_wrong_current_password_is_refused_and_the_password_and_sessions_stay', async () => {
    const account = aPasswordAccount();
    const sessions = new RecordingSessions();
    await expect(
      new ChangePassword(
        new InMemoryAccountRepository(account),
        passwords,
        sessions,
      ).execute({
        userId: 'user-1',
        sessionId: 'session-1',
        currentPassword: 'not-the-password',
        newPassword: 'another-long-password',
      }),
    ).rejects.toBeInstanceOf(InvalidPasswordError);
    expect(await passwords.verify(PASSWORD, account.passwordHash)).toBe(true);
    expect(sessions.ended).toEqual([]);
  });

  it('a_user_without_a_password_account_is_refused_as_a_wrong_password', async () => {
    await expect(
      new ChangePassword(
        new InMemoryAccountRepository(),
        passwords,
        new RecordingSessions(),
      ).execute({
        userId: 'user-1',
        sessionId: 'session-1',
        currentPassword: PASSWORD,
        newPassword: 'another-long-password',
      }),
    ).rejects.toBeInstanceOf(InvalidPasswordError);
  });
});
