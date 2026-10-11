import { Api, PASSWORD, uniqueEmail } from './support/api.js';

describe('journey: invite and accept (US2)', () => {
  const api = new Api();

  afterAll(async () => {
    await api.mailpit.cleanup();
  });

  it('an_invited_person_opens_the_link_sets_name_and_password_and_is_signed_in_as_editor', async () => {
    const admin = await api.signInAsAdministrator();
    const email = uniqueEmail('editor');
    const started = Date.now();

    const created = await api.call('/api/v1/invitations', {
      method: 'POST',
      cookie: admin,
      body: { email, role: 'editor' },
    });
    expect(created.status).toBe(201);
    const link = await api.mailpit.linkFor(
      email,
      /https?:\/\/\S+invitations\/accept\?token=\S+/,
    );
    const token = new URL(link).searchParams.get('token') ?? '';

    const verified = await api.call('/api/v1/invitations/verify', {
      method: 'POST',
      body: { token },
    });
    expect(verified.status).toBe(200);
    expect(await verified.json()).toMatchObject({ email, role: 'editor' });

    const accepted = await api.call('/api/v1/invitations/accept', {
      method: 'POST',
      body: { token, name: 'Journey Editor', password: PASSWORD },
    });
    expect(accepted.status).toBe(200);
    const me = await api.whoAmI(
      accepted.headers
        .getSetCookie()
        .map((c) => c.split(';')[0])
        .join('; '),
    );
    expect(me).toMatchObject({ status: 200, email });
    expect(Date.now() - started).toBeLessThan(120_000);

    const used = await api.call('/api/v1/invitations/verify', {
      method: 'POST',
      body: { token },
    });
    expect(used.status).toBe(410);
    expect(await used.json()).toMatchObject({ statusCode: 410 });

    const again = await api.call('/api/v1/invitations', {
      method: 'POST',
      cookie: admin,
      body: { email, role: 'editor' },
    });
    expect(again.status).toBe(409);
    await api.call('/api/v1/auth/session', { method: 'DELETE', cookie: admin });
  });
});
