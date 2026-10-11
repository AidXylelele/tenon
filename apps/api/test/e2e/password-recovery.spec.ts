import { Api, PASSWORD } from './support/api.js';

describe('journey: recover a forgotten password (US3)', () => {
  const api = new Api();

  afterAll(async () => {
    await api.mailpit.cleanup();
  });

  it('a_user_requests_recovery_sets_a_new_password_and_the_old_session_and_password_stop_working', async () => {
    const { email, cookie: earlier } = await api.inviteAndAccept('viewer');
    const started = Date.now();

    const requested = await api.call('/api/v1/auth/password-recovery', {
      method: 'POST',
      body: { email },
    });
    const unknown = await api.call('/api/v1/auth/password-recovery', {
      method: 'POST',
      body: { email: 'nobody@example.com' },
    });
    expect(requested.status).toBe(202);
    expect(await requested.text()).toBe(await unknown.text());

    const link = await api.mailpit.linkFor(
      email,
      /https?:\/\/\S+reset-password\?token=\S+/,
    );
    const token = new URL(link).searchParams.get('token') ?? '';
    const reset = await api.call('/api/v1/auth/password-recovery/complete', {
      method: 'POST',
      body: { token, newPassword: 'new-correct-horse-battery' },
    });
    expect(reset.status).toBe(204);

    expect(
      (await api.whoAmI(earlier)).status === 200 &&
        (await api.whoAmI(earlier)).email
        ? 'alive'
        : 'ended',
    ).toBe('ended');
    expect((await api.signIn(email, PASSWORD)).status).toBe(401);
    const fresh = await api.signIn(email, 'new-correct-horse-battery');
    expect(fresh.status).toBe(200);
    expect(Date.now() - started).toBeLessThan(300_000);

    const reused = await api.call('/api/v1/auth/password-recovery/complete', {
      method: 'POST',
      body: { token, newPassword: 'another-long-password-1' },
    });
    expect(reused.status).toBe(400);
    await api.call('/api/v1/auth/session', {
      method: 'DELETE',
      cookie: fresh.cookie,
    });
  });
});
