import { ADMIN_EMAIL, Api } from './support/api.js';

describe('journey: sign in and sign out (US1)', () => {
  const api = new Api();

  afterAll(async () => {
    await api.mailpit.cleanup();
  });

  it('the_administrator_signs_in_uses_the_api_and_signs_out', async () => {
    const cookie = await api.signInAsAdministrator();
    expect(cookie).toContain('sid=');
    expect(await api.sessionStatus(cookie)).toBe(200);

    const wrong = await api.signIn(ADMIN_EMAIL, 'definitely-not-the-password');
    const unknown = await api.signIn(
      'nobody@example.com',
      'definitely-not-the-password',
    );
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);

    const signedOut = await api.call('/api/v1/auth/session', {
      method: 'DELETE',
      cookie,
    });
    expect(signedOut.status).toBe(204);
    expect(await api.sessionStatus(cookie)).toBe(401);
  });
});
