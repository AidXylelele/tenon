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
import { invitationTokenFor } from '../support/mail-helpers.js';

describe('invitations over HTTP', () => {
  let t: TestApp;
  let adminCookie: string;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateAll(t.db);
    t.mail.clear();
    await createUser(t, {
      email: 'admin@example.com',
      role: 'admin',
      name: 'Ada Admin',
    });
    adminCookie = await signIn(t.server, 'admin@example.com');
  });

  const invite = (email: string, role = 'editor', cookie = adminCookie) =>
    request(t.server)
      .post('/api/v1/invitations')
      .set(authHeaders(cookie))
      .send({ email, role });

  const list = (cookie = adminCookie) =>
    request(t.server).get('/api/v1/invitations').set(authHeaders(cookie));

  const revoke = (id: string, cookie = adminCookie) =>
    request(t.server)
      .delete(`/api/v1/invitations/${id}`)
      .set(authHeaders(cookie));

  const verify = (token: string) =>
    request(t.server).post('/api/v1/invitations/verify').send({ token });

  const accept = (
    token: string,
    body: Record<string, unknown> = {},
    headers: Record<string, string> = {},
  ) =>
    request(t.server)
      .post('/api/v1/invitations/accept')
      .set(headers)
      .send({ token, name: 'Newcomer', password: PASSWORD, ...body });

  it('an_administrator_creates_an_invitation_and_the_invited_person_gets_the_link_by_email_after_the_outbox_run', async () => {
    const response = await invite('new@example.com').expect(201);
    expect(response.body).toMatchObject({
      email: 'new@example.com',
      role: 'editor',
      status: 'pending',
    });
    expect(t.mail.mails).toHaveLength(0);
    const token = await invitationTokenFor(t, 'new@example.com');
    expect(t.mail.lastTo('new@example.com')?.text).toContain('Ada Admin');
    await verify(token).expect(200);
  });

  it('an_editor_and_an_anonymous_caller_are_refused', async () => {
    await createUser(t, { email: 'editor@example.com', role: 'editor' });
    const editorCookie = await signIn(t.server, 'editor@example.com');
    const forbidden = await invite(
      'new@example.com',
      'viewer',
      editorCookie,
    ).expect(403);
    expect(forbidden.body).toMatchObject({ statusCode: 403 });
    await request(t.server)
      .post('/api/v1/invitations')
      .send({ email: 'new@example.com', role: 'viewer' })
      .expect(401);
    await list(editorCookie).expect(403);
  });

  it('an_email_with_an_account_is_refused_as_a_conflict', async () => {
    const response = await invite('admin@example.com').expect(409);
    expect(response.body).toMatchObject({ statusCode: 409 });
  });

  it('an_invalid_email_or_role_is_refused_with_every_validation_message', async () => {
    const response = await request(t.server)
      .post('/api/v1/invitations')
      .set(authHeaders(adminCookie))
      .send({ email: 'nope', role: 'owner' })
      .expect(400);
    expect(response.body).toMatchObject({ statusCode: 400 });
    expect(response.body.message).toHaveLength(2);
  });

  it('the_link_verifies_accepts_once_signs_the_person_in_and_is_used_afterwards', async () => {
    await invite('new@example.com').expect(201);
    const token = await invitationTokenFor(t, 'new@example.com');
    const verified = await verify(token).expect(200);
    expect(verified.body).toMatchObject({
      email: 'new@example.com',
      role: 'editor',
      expiresAt: expect.any(String),
    });

    const accepted = await accept(token).expect(200);
    expect(accepted.body).toMatchObject({
      user: { email: 'new@example.com', name: 'Newcomer', role: 'editor' },
    });
    const cookies = (accepted.headers['set-cookie'] ?? []) as string[];
    expect(cookies.join(';')).toContain('sid=');
    await request(t.server)
      .get('/api/v1/probe/user')
      .set(authHeaders(cookieHeader(cookies)))
      .expect(200);

    const used = await verify(token).expect(410);
    expect(used.body).toMatchObject({ statusCode: 410 });
    await accept(token).expect(410);
  });

  it('a_password_outside_the_policy_is_refused_at_the_boundary_and_the_invitation_stays_usable', async () => {
    await invite('new@example.com').expect(201);
    const token = await invitationTokenFor(t, 'new@example.com');
    const short = await accept(token, { password: 'short1' }).expect(400);
    expect(short.body).toMatchObject({ statusCode: 400 });
    expect(short.body.message).toHaveLength(1);
    await accept(token, { password: 'a'.repeat(129) }).expect(400);
    await verify(token).expect(200);
  });

  it('accepting_while_signed_in_ends_the_existing_session_first', async () => {
    await invite('new@example.com').expect(201);
    const token = await invitationTokenFor(t, 'new@example.com');
    await accept(token, {}, authHeaders(adminCookie)).expect(200);
    await request(t.server)
      .get('/api/v1/probe/user')
      .set(authHeaders(adminCookie))
      .expect(401);
  });

  it('a_pending_invitation_is_listed_and_a_revoked_one_disappears_and_its_link_stops_working', async () => {
    const created = await invite('new@example.com').expect(201);
    const token = await invitationTokenFor(t, 'new@example.com');
    const id = created.body.id as string;
    const listed = await list().expect(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0]).toMatchObject({ id, status: 'pending' });
    await revoke(id).expect(204);
    const revoked = await verify(token).expect(410);
    expect(revoked.body).toMatchObject({ statusCode: 410 });
    const after = await list().expect(200);
    expect(after.body).toHaveLength(0);
    await revoke(id).expect(410);
    await revoke('00000000-0000-0000-0000-000000000000').expect(404);
  });

  it('simultaneous_acceptances_of_one_link_create_one_account_and_refuse_the_rest', async () => {
    await invite('new@example.com').expect(201);
    const token = await invitationTokenFor(t, 'new@example.com');
    const responses = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        accept(token, { name: `Racer ${i}` }),
      ),
    );
    const statuses = responses.map((response) => response.status);
    expect(statuses.filter((status) => status === 200)).toHaveLength(1);
    for (const status of statuses.filter((status) => status !== 200)) {
      expect([409, 410]).toContain(status);
    }
    await signIn(t.server, 'new@example.com');
  });

  it('revoking_an_accepted_invitation_is_refused_and_the_account_keeps_working', async () => {
    const created = await invite('new@example.com').expect(201);
    const token = await invitationTokenFor(t, 'new@example.com');
    await accept(token).expect(200);
    const refused = await revoke(created.body.id as string).expect(410);
    expect(refused.body).toMatchObject({ statusCode: 410 });
    await signIn(t.server, 'new@example.com');
  });

  it('a_second_invitation_for_a_pending_email_replaces_the_first_link', async () => {
    await invite('new@example.com').expect(201);
    const first = await invitationTokenFor(t, 'new@example.com');
    await invite('new@example.com', 'viewer').expect(201);
    const second = await invitationTokenFor(t, 'new@example.com');
    expect(second).not.toBe(first);
    const firstRefused = await verify(first).expect(410);
    expect(firstRefused.body).toMatchObject({ statusCode: 410 });
    const verified = await verify(second).expect(200);
    expect(verified.body).toMatchObject({ role: 'viewer' });
  });

  it('an_unknown_token_is_not_found', async () => {
    const response = await verify('x'.repeat(43)).expect(404);
    expect(response.body).toMatchObject({ statusCode: 404 });
  });

  it('when_the_mail_server_fails_the_invitation_still_exists_and_no_mail_is_lost', async () => {
    t.mail.failNext(new Error('smtp unavailable'));
    const created = await invite('new@example.com').expect(201);
    await t.deliverOutbox();
    expect(t.mail.mails).toHaveLength(0);
    const listed = await list().expect(200);
    expect(listed.body[0]).toMatchObject({ id: created.body.id as string });
  });
});
