import request from 'supertest';
import { Role } from '../../../src/domain/identity/enums.js';
import type { JsonObject } from '../../../src/domain/automation/json.js';
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

const STRUCTURED = 'application/cloudevents+json';

// A version that waits for one placed order and keeps what it carried.
const aListeningDocument = (to: JsonObject): JsonObject =>
  aDocument({}, [
    { awaitOrder: { listen: { to } } },
    { keep: { set: { received: '${ . }' } } },
  ]);

const placed = (id: string, data: JsonObject): JsonObject => ({
  specversion: '1.0',
  id,
  source: '/shop',
  type: 'order.placed',
  data,
});

describe('a run that listens for events', () => {
  let run: RunApp;
  let t: TestApp;
  let editor: Record<string, string>;

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
    editor = authHeaders(await signIn(t.server, 'editor@example.com'));
  });

  async function send(event: JsonObject): Promise<void> {
    await request(t.server)
      .post('/api/v1/events')
      .set(editor)
      .set('content-type', STRUCTURED)
      .send(JSON.stringify(event))
      .expect(202);
    await relay(t);
    await drain(t);
  }

  it('an_event_of_the_awaited_type_resumes_the_run_with_its_data', async () => {
    const one = { one: { with: { type: 'order.placed' } } };
    await publish(t, editor, aListeningDocument(one));
    const { id } = await start(t, editor);
    await drain(t);

    expect((await instanceOf(t, editor, id)).phase).toBe('waiting');

    await send(placed('order-1', { total: 42 }));
    const instance = await instanceOf(t, editor, id);

    expect(instance.phase).toBe('completed');
    // A listen gives the ordered array of the events it consumed (DSL 1.0.3, "Listen").
    expect(instance.output).toEqual({ received: [{ total: 42 }] });
  });

  it('every_run_listening_for_the_type_receives_the_event', async () => {
    const one = { one: { with: { type: 'order.placed' } } };
    await publish(t, editor, aListeningDocument(one));
    const first = await start(t, editor);
    const second = await start(t, editor);
    await drain(t);

    await send(placed('order-1', { total: 7 }));

    expect((await instanceOf(t, editor, first.id)).phase).toBe('completed');
    expect((await instanceOf(t, editor, second.id)).phase).toBe('completed');
  });

  it('an_event_accepted_before_the_listen_began_does_not_reach_it', async () => {
    const one = { one: { with: { type: 'order.placed' } } };
    await publish(t, editor, aListeningDocument(one));
    await send(placed('order-early', { total: 1 }));

    const { id } = await start(t, editor);
    await drain(t);

    expect((await instanceOf(t, editor, id)).phase).toBe('waiting');
  });

  it('an_event_its_filter_refuses_leaves_the_run_waiting', async () => {
    const big = {
      one: {
        with: { type: 'order.placed', data: '${ .total > 100 }' },
      },
    };
    await publish(t, editor, aListeningDocument(big));
    const { id } = await start(t, editor);
    await drain(t);

    await send(placed('order-small', { total: 5 }));

    expect((await instanceOf(t, editor, id)).phase).toBe('waiting');

    await send(placed('order-big', { total: 500 }));

    expect((await instanceOf(t, editor, id)).phase).toBe('completed');
  });

  it('the_same_event_sent_twice_is_consumed_once', async () => {
    const twoOrders = {
      any: [{ with: { type: 'order.placed' } }],
      until: '${ length >= 2 }',
    };
    await publish(t, editor, aListeningDocument(twoOrders));
    const { id } = await start(t, editor);
    await drain(t);

    await send(placed('order-1', { total: 1 }));
    await send(placed('order-1', { total: 1 }));

    expect((await instanceOf(t, editor, id)).phase).toBe('waiting');

    await send(placed('order-2', { total: 2 }));

    expect((await instanceOf(t, editor, id)).phase).toBe('completed');
  });
});
