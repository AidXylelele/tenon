import { sql } from 'drizzle-orm';
import request from 'supertest';
import type { JsonObject } from '../../../src/domain/automation/json.js';
import { Role } from '../../../src/domain/identity/enums.js';
import { authHeaders, createUser, signIn } from '../../support/auth-helpers.js';
import { aDocument } from '../../support/builders.js';
import type { TestApp } from '../../support/create-test-app.js';
import {
  createRunApp,
  drain,
  instanceOf,
  publish,
  type RunApp,
  relay,
  resetRuns,
  start,
} from '../../support/run-helpers.js';

const PROBLEM = 'application/problem+json';
const TYPE = 'com.example.form.submitted';

interface StoredEvent {
  readonly type: string;
  readonly source: string;
  readonly origin: string;
  readonly cloud_event: JsonObject;
}

describe('webhooks: secret URLs other applications call (US5)', () => {
  let run: RunApp;
  let t: TestApp;
  let editor: Record<string, string>;
  let viewer: Record<string, string>;

  beforeAll(async () => {
    run = await createRunApp();
    t = run.t;
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await resetRuns(t);
    await createUser(t, { email: 'editor@example.com', role: Role.Editor });
    await createUser(t, { email: 'viewer@example.com', role: Role.Viewer });
    editor = authHeaders(await signIn(t.server, 'editor@example.com'));
    viewer = authHeaders(await signIn(t.server, 'viewer@example.com'));
  });

  async function createWebhook(): Promise<{ id: string; path: string }> {
    const response = await request(t.server)
      .post('/api/v1/webhooks')
      .set(editor)
      .send({ name: 'forms', eventType: TYPE })
      .expect(201);
    const body = response.body as { id: string; url: string };
    const path = new URL(body.url).pathname;
    return { id: body.id, path };
  }

  async function storedEvents(): Promise<StoredEvent[]> {
    const result = await t.db.execute(
      sql`select type, source, origin, cloud_event from event where origin = 'webhook' order by sequence`,
    );
    return result.rows as unknown as StoredEvent[];
  }

  it('the_url_is_shown_once_at_creation_and_the_webhook_is_listed_without_it', async () => {
    const response = await request(t.server)
      .post('/api/v1/webhooks')
      .set(editor)
      .send({ name: 'forms', eventType: TYPE })
      .expect(201);
    const listed = await request(t.server)
      .get('/api/v1/webhooks')
      .set(editor)
      .expect(200);

    expect(response.body).toMatchObject({ name: 'forms', eventType: TYPE });
    expect(String(response.body.url)).toMatch(
      /\/api\/v1\/hooks\/[A-Za-z0-9_-]{43}$/,
    );
    expect(listed.body).toEqual([
      {
        id: response.body.id,
        name: 'forms',
        eventType: TYPE,
        createdAt: response.body.createdAt,
      },
    ]);
  });

  it('a_viewer_cannot_manage_webhooks', async () => {
    await request(t.server)
      .post('/api/v1/webhooks')
      .set(viewer)
      .send({ name: 'forms', eventType: TYPE })
      .expect(403);
    await request(t.server).get('/api/v1/webhooks').set(viewer).expect(403);
  });

  it('a_call_is_acknowledged_and_accepted_as_one_event_without_credentials', async () => {
    const webhook = await createWebhook();

    await request(t.server)
      .post(`${webhook.path}?campaign=autumn`)
      .set('Authorization', 'Bearer leaked')
      .set('Cookie', 'sid=leaked')
      .set('X-Trace', 'trace-1')
      .send({ email: 'ada@example.com' })
      .expect(202);
    const [event] = await storedEvents();

    expect(event).toMatchObject({
      type: TYPE,
      source: `/webhooks/${webhook.id}`,
    });
    const data = event?.cloud_event.data as JsonObject;
    expect(data.body).toEqual({ email: 'ada@example.com' });
    expect(data.query).toEqual({ campaign: 'autumn' });
    const headers = data.headers as JsonObject;
    expect(headers['x-trace']).toBe('trace-1');
    expect(headers.authorization).toBeUndefined();
    expect(headers.cookie).toBeUndefined();
  });

  it('a_body_that_is_not_json_is_carried_as_text', async () => {
    const webhook = await createWebhook();

    await request(t.server)
      .post(webhook.path)
      .set('Content-Type', 'text/plain')
      .send('name=ada')
      .expect(202);
    const [event] = await storedEvents();

    expect((event?.cloud_event.data as JsonObject).body).toBe('name=ada');
  });

  it('calls_with_the_same_idempotency_key_are_accepted_once', async () => {
    const webhook = await createWebhook();

    for (let attempt = 0; attempt < 2; attempt += 1)
      await request(t.server)
        .post(webhook.path)
        .set('Idempotency-Key', 'delivery-1')
        .send({ attempt })
        .expect(202);

    expect(await storedEvents()).toHaveLength(1);
  });

  it('a_deleted_webhook_and_an_unknown_url_answer_alike_and_accept_nothing', async () => {
    const webhook = await createWebhook();
    await request(t.server)
      .delete(`/api/v1/webhooks/${webhook.id}`)
      .set(editor)
      .expect(204);

    const deleted = await request(t.server).post(webhook.path).send({});
    const unknown = await request(t.server)
      .post('/api/v1/hooks/unknown-token')
      .send({});

    expect(deleted.status).toBe(404);
    expect(deleted.headers['content-type']).toContain(PROBLEM);
    expect(unknown.status).toBe(404);
    expect(unknown.body).toEqual(deleted.body);
    expect(await storedEvents()).toHaveLength(0);
  });

  it('a_call_above_the_size_limit_is_refused_and_accepts_nothing', async () => {
    const webhook = await createWebhook();
    const large = 'x'.repeat(1024 * 1024 + 1);

    await request(t.server)
      .post(webhook.path)
      .set('Content-Type', 'text/plain')
      .send(large)
      .expect(413);

    expect(await storedEvents()).toHaveLength(0);
  });

  it('a_run_listening_for_the_webhooks_type_receives_the_call', async () => {
    const webhook = await createWebhook();
    const document = aDocument({}, [
      { awaitForm: { listen: { to: { one: { with: { type: TYPE } } } } } },
    ]);
    await publish(t, editor, document);
    const { id } = await start(t, editor);
    await drain(t);

    await request(t.server)
      .post(webhook.path)
      .send({ email: 'ada@example.com' })
      .expect(202);
    await relay(t);
    await drain(t);
    const instance = await instanceOf(t, editor, id);

    expect(instance.phase).toBe('completed');
    expect(instance.output).toMatchObject([
      { body: { email: 'ada@example.com' } },
    ]);
  });
});
