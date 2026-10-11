import request from 'supertest';
import {
  authHeaders,
  cookieHeader,
  createUser,
  expireSession,
  PASSWORD,
  signIn,
  suspendUser,
} from '../support/auth-helpers.js';
import { createTestApp, type TestApp } from '../support/create-test-app.js';
import { truncateAll } from '../support/db.js';

describe('sign in and sign out over HTTP', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateAll(t.db);
  });

  const attempt = (email: string, password: string, address?: string) => {
    let req = request(t.server).post('/api/v1/auth/session');

    if (address) req = req.set('x-forwarded-for', address);

    return req.send({ email, password });
  };

  it('correct_credentials_establish_an_http_only_lax_session_cookie_and_return_the_user', async () => {
    await createUser(t, { email: 'user@example.com', name: 'User' });
    const response = await attempt('user@example.com', PASSWORD).expect(200);
    expect(response.body).toMatchObject({
      user: { email: 'user@example.com', name: 'User', role: 'viewer' },
    });
    const cookies = (response.headers['set-cookie'] ?? []) as string[];
    const session = cookies.find((cookie) => cookie.startsWith('sid='));
    expect(session).toMatch(/HttpOnly/i);
    expect(session).toMatch(/SameSite=Lax/i);
    expect(session).not.toMatch(/Secure/);
    const me = await request(t.server)
      .get('/api/v1/auth/session')
      .set(authHeaders(cookieHeader(cookies)))
      .expect(200);
    expect(me.body).toMatchObject({ user: { email: 'user@example.com' } });
  });

  it('a_wrong_password_and_an_unknown_email_get_byte_identical_responses', async () => {
    await createUser(t, { email: 'user@example.com' });
    const wrongPassword = await attempt(
      'user@example.com',
      'definitely-not-the-password',
    ).expect(401);
    const unknownEmail = await attempt(
      'nobody@example.com',
      'definitely-not-the-password',
    ).expect(401);
    expect(wrongPassword.text).toBe(unknownEmail.text);
    expect(wrongPassword.body).toMatchObject({ statusCode: 401 });
  });

  it('sign_out_ends_the_session_and_the_cookie_is_refused_afterwards', async () => {
    await createUser(t, { email: 'user@example.com' });
    const cookie = await signIn(t.server, 'user@example.com');
    await request(t.server)
      .get('/api/v1/probe/user')
      .set(authHeaders(cookie))
      .expect(200);
    await request(t.server)
      .delete('/api/v1/auth/session')
      .set(authHeaders(cookie))
      .expect(204);
    const refused = await request(t.server)
      .get('/api/v1/probe/user')
      .set(authHeaders(cookie))
      .expect(401);
    expect(refused.body).toMatchObject({ statusCode: 401 });
  });

  it('a_session_past_its_lifetime_is_refused', async () => {
    await createUser(t, { email: 'user@example.com' });
    const cookie = await signIn(t.server, 'user@example.com');
    await expireSession(t.db, cookie);
    await request(t.server)
      .get('/api/v1/probe/user')
      .set(authHeaders(cookie))
      .expect(401);
  });

  it('a_suspended_user_is_refused_with_a_suspension_message_and_their_sessions_stop_working', async () => {
    const user = await createUser(t, { email: 'user@example.com' });
    const cookie = await signIn(t.server, 'user@example.com');
    await suspendUser(t.db, user.id);
    await request(t.server)
      .get('/api/v1/probe/user')
      .set(authHeaders(cookie))
      .expect(401);
    const refused = await attempt('user@example.com', PASSWORD).expect(403);
    expect(refused.body).toMatchObject({ message: 'The account is suspended' });
  });

  it('email_addresses_are_compared_case_insensitively', async () => {
    await createUser(t, { email: 'user@example.com' });
    await attempt('User@Example.COM', PASSWORD).expect(200);
  });

  it('the_twenty_first_sign_in_request_from_one_client_address_within_ten_minutes_is_refused_while_other_addresses_continue', async () => {
    await createUser(t, { email: 'user@example.com' });
    for (let i = 0; i < 20; i += 1) {
      await attempt(
        'user@example.com',
        'definitely-not-the-password',
        '198.51.100.1',
      ).expect(401);
    }
    const throttled = await attempt(
      'user@example.com',
      'definitely-not-the-password',
      '198.51.100.1',
    ).expect(429);
    expect(Number(throttled.headers['retry-after'])).toBeGreaterThan(0);
    await attempt(
      'user@example.com',
      'definitely-not-the-password',
      '198.51.100.2',
    ).expect(401);
  });
});
