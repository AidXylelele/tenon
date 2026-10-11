import request from 'supertest';
import {
  authHeaders,
  cookieHeader,
  createUser,
  PASSWORD,
  signIn,
} from '../support/auth-helpers.js';
import { createTestApp, type TestApp } from '../support/create-test-app.js';
import { truncateAll } from '../support/db.js';

const NEW_PASSWORD = 'another-long-password-9';

describe('change own password over HTTP', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateAll(t.db);
    await createUser(t, { email: 'user@example.com' });
  });

  const change = (
    cookie: string | undefined,
    body: Record<string, unknown>,
  ) => {
    let req = request(t.server).patch('/api/v1/auth/password');

    if (cookie) req = req.set(authHeaders(cookie));

    return req.send({
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
      ...body,
    });
  };

  it('the_correct_current_password_replaces_the_password_keeps_the_caller_signed_in_and_ends_other_sessions', async () => {
    const caller = await signIn(t.server, 'user@example.com');
    const other = await signIn(t.server, 'user@example.com');
    const response = await change(caller, {}).expect(204);
    const fresh = cookieHeader(response.headers['set-cookie']);
    expect(fresh).toContain('sid=');
    await request(t.server)
      .get('/api/v1/probe/user')
      .set(authHeaders(fresh))
      .expect(200);
    await request(t.server)
      .get('/api/v1/probe/user')
      .set(authHeaders(other))
      .expect(401);
    await request(t.server)
      .post('/api/v1/auth/session')
      .send({ email: 'user@example.com', password: PASSWORD })
      .expect(401);
    await signIn(t.server, 'user@example.com', NEW_PASSWORD);
  });

  it('a_wrong_current_password_is_refused_and_the_password_stays', async () => {
    const caller = await signIn(t.server, 'user@example.com');
    const response = await change(caller, {
      currentPassword: 'not-the-current-password',
    }).expect(400);
    expect(response.body).toMatchObject({
      message: 'The current password is wrong',
    });
    await signIn(t.server, 'user@example.com', PASSWORD);
  });

  it('a_new_password_outside_the_policy_is_refused', async () => {
    const caller = await signIn(t.server, 'user@example.com');
    await change(caller, { newPassword: 'short1' }).expect(400);
    await change(caller, { newPassword: 'a'.repeat(129) }).expect(400);
    await signIn(t.server, 'user@example.com', PASSWORD);
  });

  it('a_request_without_a_session_is_refused', async () => {
    await change(undefined, {}).expect(401);
  });
});
