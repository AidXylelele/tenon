import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { Role } from '../../src/domain/enums.js';
import { authHeaders, createUser, signIn } from '../support/auth-helpers.js';
import { createTestApp, type TestApp } from '../support/create-test-app.js';
import { truncateAll } from '../support/db.js';

const HOOK = randomUUID();

describe('webhook endpoints over HTTP', () => {
  let t: TestApp;
  let editor: string;
  let other: string;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateAll(t.db);
    await createUser(t, { email: 'editor@example.com', role: Role.Editor });
    await createUser(t, { email: 'other@example.com', role: Role.Editor });
    editor = await signIn(t.server, 'editor@example.com');
    other = await signIn(t.server, 'other@example.com');
  });

  const withWebhook = async () => {
    const created = await request(t.server)
      .post('/api/v1/workflows')
      .set(authHeaders(editor))
      .send({ name: 'Orders' })
      .expect(201);
    const id = created.body.id as string;
    await request(t.server)
      .put(`/api/v1/workflows/${id}/draft`)
      .set(authHeaders(editor))
      .send({
        revision: 1,
        graph: {
          nodes: [
            {
              id: HOOK,
              name: 'Hook',
              type: 'webhook',
              typeVersion: 1,
              parameters: { methods: { fixed: ['POST', 'PUT'] } },
              position: [0, 0],
            },
          ],
          connections: [],
        },
        settings: {},
      })
      .expect(200);
    return id;
  };

  it('the_owner_reads_the_address_settings_and_secret_of_each_webhook_node', async () => {
    const id = await withWebhook();
    const response = await request(t.server)
      .get(`/api/v1/workflows/${id}/webhooks`)
      .set(authHeaders(editor))
      .expect(200);
    expect(response.body.items).toEqual([
      {
        nodeId: HOOK,
        url: expect.stringMatching(
          /^http:\/\/127\.0\.0\.1:3000\/api\/v1\/webhooks\/[\w-]{43}$/,
        ),
        methods: ['POST', 'PUT'],
        authentication: 'token',
        secret: expect.stringMatching(/^[\w-]{43}$/),
      },
    ]);
    await request(t.server)
      .get(`/api/v1/workflows/${id}/webhooks`)
      .set(authHeaders(other))
      .expect(403);
  });

  it('rotating_gives_a_new_secret_at_the_same_address', async () => {
    const id = await withWebhook();
    const before = await request(t.server)
      .get(`/api/v1/workflows/${id}/webhooks`)
      .set(authHeaders(editor))
      .expect(200);
    const rotated = await request(t.server)
      .post(`/api/v1/workflows/${id}/webhooks/${HOOK}/secret`)
      .set(authHeaders(editor))
      .expect(200);
    expect(rotated.body.url).toBe(before.body.items[0].url);
    expect(rotated.body.secret).not.toBe(before.body.items[0].secret);
    await request(t.server)
      .post(`/api/v1/workflows/${id}/webhooks/${randomUUID()}/secret`)
      .set(authHeaders(editor))
      .expect(404);
  });
});
