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
  publish,
  type RunApp,
  relay,
  resetRuns,
} from '../../support/run-helpers.js';

const WORKFLOW = '/api/v1/workflows/sales/route-lead';
const STRUCTURED = 'application/cloudevents+json';

interface InstanceRow {
  readonly id: string;
  readonly trigger: string;
  readonly phase: string;
  readonly input: unknown;
}

// A version that starts by itself as the schedule says, and completes at once.
const aScheduledDocument = (schedule: JsonObject, version = '1.0.0') => ({
  ...aDocument({ version }, [{ greet: { set: { greeted: true } } }]),
  schedule,
});

describe('starting workflows on a schedule and on events (US4)', () => {
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
    await t.db.execute(sql`truncate table nest_workflows.schedules cascade`);
    await createUser(t, { email: 'editor@example.com', role: Role.Editor });
    editor = authHeaders(await signIn(t.server, 'editor@example.com'));
  });

  async function turn(state: 'on' | 'off'): Promise<void> {
    await request(t.server)
      .post(`${WORKFLOW}/turn-${state}`)
      .set(editor)
      .expect(204);
    await relay(t);
  }

  async function instances(): Promise<InstanceRow[]> {
    const result = await t.db.execute(
      sql`select id, trigger, phase, input from workflow_instance order by created_at, id`,
    );
    return result.rows as unknown as InstanceRow[];
  }

  async function pass(duration: `${number}${'s' | 'm'}`): Promise<void> {
    run.clock.advance(duration);
    await drain(t);
    await relay(t);
    await drain(t);
  }

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

  it('a_workflow_is_off_until_turned_on_and_shows_it', async () => {
    await publish(t, editor, aScheduledDocument({ every: { minutes: 1 } }));

    const before = await request(t.server).get(WORKFLOW).set(editor);
    await turn('on');
    const after = await request(t.server).get(WORKFLOW).set(editor);

    expect(before.body.on).toBe(false);
    expect(after.body.on).toBe(true);
  });

  it('every_interval_starts_one_instance_per_occurrence_while_on', async () => {
    await publish(t, editor, aScheduledDocument({ every: { minutes: 1 } }));
    await turn('on');

    await pass('1m');
    await pass('1m');
    const started = await instances();

    expect(started).toHaveLength(2);
    expect(started.every((row) => row.trigger === 'schedule')).toBe(true);
    expect(started.every((row) => row.phase === 'completed')).toBe(true);
  });

  it('turning_off_stops_automatic_starts_but_not_manual_ones', async () => {
    await publish(t, editor, aScheduledDocument({ every: { minutes: 1 } }));
    await turn('on');
    await pass('1m');

    await turn('off');
    await pass('5m');
    await request(t.server)
      .post(`${WORKFLOW}/instances`)
      .set(editor)
      .send({ input: {} })
      .expect(201);

    const triggers = (await instances()).map((row) => row.trigger);
    expect(triggers).toEqual(['schedule', 'manual']);
  });

  it('a_cron_occurrence_starts_one_instance_in_utc', async () => {
    await publish(t, editor, aScheduledDocument({ cron: '* * * * *' }));
    await turn('on');

    await pass('1m');

    expect(await instances()).toHaveLength(1);
  });

  // `every` repeats from the epoch, and the clock is shared by the file: a day keeps the next
  // occurrence of the new schedule out of the minute that follows.
  it('a_new_version_replaces_the_schedule_of_the_previous_one', async () => {
    await publish(t, editor, aScheduledDocument({ every: { minutes: 1 } }));
    await turn('on');
    await publish(
      t,
      editor,
      aScheduledDocument({ every: { hours: 24 } }, '2.0.0'),
    );
    await relay(t);

    await pass('1m');

    expect(await instances()).toHaveLength(0);
  });

  it('an_event_its_schedule_takes_starts_one_instance_with_the_event_as_input', async () => {
    const on = { one: { with: { type: 'com.example.order.paid' } } };
    await publish(t, editor, aScheduledDocument({ on }));
    await turn('on');
    const paid = {
      specversion: '1.0',
      id: 'order-1',
      source: '/shop',
      type: 'com.example.order.paid',
      data: { total: 3 },
    };

    await send(paid);
    await send(paid);
    await relay(t);
    const started = await instances();

    expect(started).toHaveLength(1);
    expect(started[0]?.trigger).toBe('event');
    expect(started[0]?.input).toMatchObject([
      { id: 'order-1', data: { total: 3 } },
    ]);
  });

  it('an_event_of_another_type_or_to_a_workflow_that_is_off_starts_nothing', async () => {
    const on = { one: { with: { type: 'com.example.order.paid' } } };
    await publish(t, editor, aScheduledDocument({ on }));
    const paid = {
      specversion: '1.0',
      id: 'order-1',
      source: '/shop',
      type: 'com.example.order.paid',
    };

    await send(paid);
    await turn('on');
    await send({ ...paid, id: 'order-2', type: 'com.example.order.placed' });

    expect(await instances()).toHaveLength(0);
  });

  it('after_starts_the_next_instance_once_the_previous_completed_and_the_delay_passed', async () => {
    await publish(t, editor, aScheduledDocument({ after: { minutes: 5 } }));
    await turn('on');
    await drain(t);

    expect(await instances()).toHaveLength(1);

    await pass('4m');
    expect(await instances()).toHaveLength(1);

    await pass('1m');
    expect(await instances()).toHaveLength(2);
  });

  it('a_cron_the_engine_cannot_run_is_refused_at_publish', async () => {
    const response = await request(t.server)
      .post('/api/v1/workflows')
      .set(editor)
      .send(aScheduledDocument({ cron: 'every monday' }));

    expect(response.status).toBe(422);
    expect(response.body.errors[0].pointer).toBe('/schedule/cron');
  });
});
