import { Api, PASSWORD } from './support/api.js';

describe('journey: change own password (US4)', () => {
  const api = new Api();

  afterAll(async () => {
    await api.mailpit.cleanup();
  });

  it('a_signed_in_user_changes_the_password_other_sessions_end_and_the_caller_stays_signed_in', async () => {
    const { email } = await api.inviteAndAccept('viewer');
    const caller = await api.signIn(email, PASSWORD);
    const other = await api.signIn(email, PASSWORD);
    expect(caller.status).toBe(200);
    expect(other.status).toBe(200);

    const changed = await api.call('/api/v1/auth/password', {
      method: 'PATCH',
      cookie: caller.cookie,
      body: {
        currentPassword: PASSWORD,
        newPassword: 'another-long-password-9',
      },
    });
    expect(changed.status).toBe(204);
    const fresh = changed.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');
    expect((await api.whoAmI(fresh)).email).toBe(email);
    expect((await api.whoAmI(other.cookie)).email).toBeUndefined();
    expect((await api.signIn(email, PASSWORD)).status).toBe(401);
    expect((await api.signIn(email, 'another-long-password-9')).status).toBe(
      200,
    );

    const wrong = await api.call('/api/v1/auth/password', {
      method: 'PATCH',
      cookie: fresh,
      body: {
        currentPassword: 'not-the-current-password',
        newPassword: 'yet-another-long-password',
      },
    });
    expect(wrong.status).toBe(400);
    await api.call('/api/v1/auth/session', { method: 'DELETE', cookie: fresh });
  });
});
