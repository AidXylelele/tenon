import request from 'supertest';
import type { JsonObject } from '../../../src/domain/automation/json.js';
import { Role } from '../../../src/domain/identity/enums.js';
import { authHeaders, createUser, signIn } from '../../support/auth-helpers.js';
import { aDocument } from '../../support/builders.js';
import type { TestApp } from '../../support/create-test-app.js';
import {
  createRunApp,
  drain,
  publish,
  type RunApp,
  relay,
  resetRuns,
  start,
} from '../../support/run-helpers.js';

const RECEIVER = 'https://hooks.example.com';
const STRUCTURED = 'application/cloudevents+json';

interface Received {
  readonly headers: Record<string, string>;
  readonly event: JsonObject;
}

describe('delivering events to other applications (US6)', () => {
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

  // The receiver answers each delivery with the next status given, recording what it got.
  function receiver(...statuses: number[]): Received[] {
    const received: Received[] = [];

    for (const status of statuses)
      run.agent
        .get(RECEIVER)
        .intercept({ path: '/events', method: 'POST' })
        .reply((options) => {
          const headers = options.headers as Record<string, string>;
          const body = options.body as string;
          const event = JSON.parse(body) as JsonObject;
          received.push({ headers, event });
          return { statusCode: status, data: '' };
        });

    return received;
  }

  async function subscribe(
    filter: JsonObject,
    authentication?: JsonObject,
  ): Promise<string> {
    const endpoint = { uri: `${RECEIVER}/events`, authentication };
    const response = await request(t.server)
      .post('/api/v1/subscriptions')
      .set(editor)
      .send({ name: 'crm', endpoint, filter })
      .expect(201);
    return String(response.body.id);
  }

  async function send(id: string, type: string): Promise<void> {
    const event = { specversion: '1.0', id, source: '/shop', type };
    await request(t.server)
      .post('/api/v1/events')
      .set(editor)
      .set('content-type', STRUCTURED)
      .send(JSON.stringify(event))
      .expect(202);
    await relay(t);
    await drain(t);
  }

  async function deliveriesOf(id: string): Promise<JsonObject[]> {
    const response = await request(t.server)
      .get(`/api/v1/subscriptions/${id}`)
      .set(editor)
      .expect(200);
    return response.body.deliveries as JsonObject[];
  }

  it('a_subscription_is_listed_and_a_viewer_cannot_subscribe', async () => {
    const id = await subscribe({ with: { type: 'com.example.order.paid' } });

    const listed = await request(t.server)
      .get('/api/v1/subscriptions')
      .set(editor)
      .expect(200);
    await request(t.server)
      .get('/api/v1/subscriptions')
      .set(viewer)
      .expect(403);

    expect(listed.body).toMatchObject([
      { id, name: 'crm', endpoint: { uri: `${RECEIVER}/events` } },
    ]);
  });

  it('a_matching_event_is_delivered_once_in_structured_mode', async () => {
    const received = receiver(202);
    const id = await subscribe({ with: { type: 'com.example.order.paid' } });

    await send('order-1', 'com.example.order.paid');
    await send('order-2', 'com.example.order.placed');

    expect(received).toHaveLength(1);
    expect(received[0]?.headers['content-type']).toBe(STRUCTURED);
    expect(received[0]?.event).toMatchObject({
      id: 'order-1',
      type: 'com.example.order.paid',
    });
    expect(await deliveriesOf(id)).toMatchObject([
      { eventId: 'order-1', status: 'delivered', attempts: 1 },
    ]);
  });

  it('a_delivery_authenticates_with_its_owners_secret_never_shown', async () => {
    await request(t.server)
      .post('/api/v1/secrets')
      .set(editor)
      .send({ name: 'hook-token', value: 'tok-abcdef' })
      .expect(201);
    const received = receiver(200);
    const id = await subscribe(
      { with: { type: 'com.example.order.paid' } },
      { scheme: 'bearer', secret: 'hook-token' },
    );

    await send('order-1', 'com.example.order.paid');
    const detail = await request(t.server)
      .get(`/api/v1/subscriptions/${id}`)
      .set(editor);

    expect(received[0]?.headers.authorization).toBe('Bearer tok-abcdef');
    expect(JSON.stringify(detail.body)).not.toContain('tok-abcdef');
  });

  it('a_refused_delivery_is_retried_later_with_the_same_event_id', async () => {
    const received = receiver(503, 200);
    const id = await subscribe({ with: { type: 'com.example.order.paid' } });

    await send('order-1', 'com.example.order.paid');
    const pending = await deliveriesOf(id);
    run.clock.advance('2s');
    await drain(t);
    const delivered = await deliveriesOf(id);

    expect(pending).toMatchObject([
      {
        status: 'pending',
        attempts: 1,
        lastError: 'The destination answered 503',
      },
    ]);
    expect(delivered).toMatchObject([{ status: 'delivered', attempts: 2 }]);
    expect(received.map((item) => item.event.id)).toEqual([
      'order-1',
      'order-1',
    ]);
  });

  it('the_standards_lifecycle_events_are_delivered_too', async () => {
    const received = receiver(200, 200, 200);
    await subscribe({
      with: { type: 'io.serverlessworkflow.workflow.completed.v1' },
    });
    await publish(t, editor, aDocument());

    await start(t, editor);
    await drain(t);
    await relay(t);
    await drain(t);

    expect(received.map((item) => item.event.type)).toEqual([
      'io.serverlessworkflow.workflow.completed.v1',
    ]);
  });

  it('a_deleted_subscription_takes_nothing_more', async () => {
    const received = receiver(200);
    const id = await subscribe({ with: { type: 'com.example.order.paid' } });
    await request(t.server)
      .delete(`/api/v1/subscriptions/${id}`)
      .set(editor)
      .expect(204);

    await send('order-1', 'com.example.order.paid');

    expect(received).toHaveLength(0);
  });

  it('a_filter_whose_pattern_does_not_compile_is_refused_where_it_is', async () => {
    const response = await request(t.server)
      .post('/api/v1/subscriptions')
      .set(editor)
      .send({
        name: 'crm',
        endpoint: { uri: `${RECEIVER}/events` },
        filter: { with: { type: 'com.example.(' } },
      });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      type: 'urn:problem:subscription.invalid',
      errors: [{ pointer: '/filter/with/type' }],
    });
  });

  it('a_subscription_authenticating_with_a_secret_its_owner_lacks_is_refused', async () => {
    const response = await request(t.server)
      .post('/api/v1/subscriptions')
      .set(editor)
      .send({
        name: 'crm',
        endpoint: {
          uri: `${RECEIVER}/events`,
          authentication: { scheme: 'bearer', secret: 'nobody-has-it' },
        },
        filter: { with: { type: 'com.example.order.paid' } },
      });

    expect(response.status).toBe(422);
    expect(response.body.type).toBe('urn:problem:subscription.foreign-secret');
  });
});
