import request from 'supertest';
import { authHeaders, createUser, signIn } from '../support/auth-helpers.js';
import { createTestApp, type TestApp } from '../support/create-test-app.js';
import { truncateAll } from '../support/db.js';

describe('authentication, authorization policies and error responses', () => {
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

  it('the_health_route_is_public', async () => {
    const response = await request(t.server).get('/api/v1/health').expect(200);
    expect(response.body).toMatchObject({ status: 'ok' });
  });

  it('a_protected_route_without_a_cookie_is_refused_as_unauthenticated', async () => {
    const response = await request(t.server)
      .get('/api/v1/probe/user')
      .expect(401);
    expect(response.body).toMatchObject({ statusCode: 401 });
  });

  it('an_editor_passes_a_route_open_to_anyone_signed_in_but_not_the_administrator_policy', async () => {
    await createUser(t, { email: 'editor@example.com', role: 'editor' });
    const cookie = await signIn(t.server, 'editor@example.com');
    await request(t.server)
      .get('/api/v1/probe/user')
      .set(authHeaders(cookie))
      .expect(200);
    const response = await request(t.server)
      .get('/api/v1/probe/admin')
      .set(authHeaders(cookie))
      .expect(403);
    expect(response.body).toMatchObject({ statusCode: 403 });
  });

  it('an_administrator_passes_the_administrator_policy', async () => {
    await createUser(t, { email: 'admin@example.com', role: 'admin' });
    const cookie = await signIn(t.server, 'admin@example.com');
    await request(t.server)
      .get('/api/v1/probe/admin')
      .set(authHeaders(cookie))
      .expect(200);
  });

  it('an_unknown_route_answers_with_not_found', async () => {
    const response = await request(t.server).get('/api/v1/nope').expect(404);
    expect(response.body).toMatchObject({ statusCode: 404 });
  });

  it('responses_carry_the_hardening_headers_and_no_server_banner', async () => {
    const response = await request(t.server).get('/api/v1/health').expect(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['cache-control']).toContain('no-store');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});
