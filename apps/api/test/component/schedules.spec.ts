import { randomUUID } from 'node:crypto';
import {
  ManualWorkflowClock,
  WORKFLOWS_MODULE_OPTIONS,
  WorkflowClient,
  WorkflowWorker,
} from '@nestjs/workflows';
import request from 'supertest';
import { Role } from '../../src/domain/enums.js';
import { authHeaders, createUser, signIn } from '../support/auth-helpers.js';
import { createTestApp, type TestApp } from '../support/create-test-app.js';
import { truncateAll } from '../support/db.js';
import { MaintenanceWorkflow } from '../../src/interface-adapters/workflows/maintenance.workflow.js';

const TICK = randomUUID();
const STEP = randomUUID();

describe('activation and schedules', () => {
  let t: TestApp;
  let clock: ManualWorkflowClock;
  let editor: string;

  beforeAll(async () => {
    clock = new ManualWorkflowClock(Date.parse('2026-10-16T08:59:30.000Z'));
    t = await createTestApp((builder) =>
      builder
        .overrideProvider(WORKFLOWS_MODULE_OPTIONS)
        .useValue({ worker: false, clock }),
    );
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateAll(t.db);
    await createUser(t, { email: 'editor@example.com', role: Role.Editor });
    editor = await signIn(t.server, 'editor@example.com');
  });

  const call = (method: 'get' | 'post' | 'put' | 'delete', path: string) =>
    request(t.server)[method](`/api/v1${path}`).set(authHeaders(editor));

  const published = async (trigger: Record<string, unknown>) => {
    const created = await call('post', '/workflows')
      .send({ name: 'Every minute' })
      .expect(201);
    const id = created.body.id as string;
    await call('put', `/workflows/${id}/draft`)
      .send({
        revision: 1,
        graph: {
          nodes: [
            {
              id: TICK,
              name: 'Tick',
              typeVersion: 1,
              position: [0, 0],
              ...trigger,
            },
            {
              id: STEP,
              name: 'Step',
              type: 'noOp',
              typeVersion: 1,
              position: [200, 0],
            },
          ],
          connections: [
            {
              from: { node: TICK, output: 'main' },
              to: { node: STEP, input: 'main' },
            },
          ],
        },
        settings: {},
      })
      .expect(200);
    await call('post', `/workflows/${id}/releases`)
      .send({ revision: 2 })
      .expect(201);
    return id;
  };

  const everyMinute = {
    type: 'scheduleTrigger',
    parameters: {
      rules: [{ interval: { fixed: 'minutes' }, every: { fixed: 1 } }],
    },
  };

  const schedules = async (workflowId: string) => {
    const all = await t.app
      .get(WorkflowClient)
      .schedules.list({ workflow: 'automation.scheduled-trigger' });
    return all
      .map((schedule) => schedule.id)
      .filter((id) => id.startsWith(`wf.${workflowId}.`));
  };

  it('activating_a_release_registers_its_schedule_and_each_occurrence_runs_the_release', async () => {
    const id = await published(everyMinute);
    const activated = await call('put', `/workflows/${id}/activation`)
      .send({ release: 1 })
      .expect(200);
    expect(activated.body).toEqual({ release: 1 });
    await t.deliverOutbox();
    expect(await schedules(id)).toEqual([`wf.${id}.${TICK}.0`]);
    clock.advance('1m');
    await t.app.get(WorkflowWorker).drain();
    const runs = await call('get', `/workflows/${id}/runs`).expect(200);
    expect(runs.body.items).toEqual([
      expect.objectContaining({
        status: 'succeeded',
        mode: 'production',
        trigger: 'schedule',
        release: 1,
      }),
    ]);
    const opened = await call('get', `/workflows/${id}`).expect(200);
    expect(opened.body.activeRelease).toBe(1);
  });

  it('deactivating_removes_the_schedule', async () => {
    const id = await published(everyMinute);
    await call('put', `/workflows/${id}/activation`)
      .send({ release: 1 })
      .expect(200);
    await t.deliverOutbox();
    await call('delete', `/workflows/${id}/activation`).expect(204);
    await t.deliverOutbox();
    expect(await schedules(id)).toEqual([]);
    const opened = await call('get', `/workflows/${id}`).expect(200);
    expect(opened.body.activeRelease).toBeNull();
  });

  it('maintenance_restores_a_lost_schedule_and_removes_one_left_behind', async () => {
    const active = await published(everyMinute);
    await call('put', `/workflows/${active}/activation`)
      .send({ release: 1 })
      .expect(200);
    const client = t.app.get(WorkflowClient);
    const stale = `wf.${randomUUID()}.${TICK}.0`;
    await client.schedules.upsert(stale, {
      workflow: 'automation.scheduled-trigger',
      every: '1h',
      input: { workflowId: 'gone', releaseNumber: 1, nodeId: TICK },
    });
    expect(await schedules(active)).toEqual([]);
    await client.start(MaintenanceWorkflow, null, { id: `m-${active}` });
    await t.app.get(WorkflowWorker).drain();
    expect(await schedules(active)).toEqual([`wf.${active}.${TICK}.0`]);
    expect(await client.schedules.get(stale)).toBeNull();
  });

  it('a_release_without_a_trigger_or_an_unknown_release_is_not_activated', async () => {
    const id = await published({ type: 'noOp' });
    await call('put', `/workflows/${id}/activation`)
      .send({ release: 1 })
      .expect(422);
    await call('put', `/workflows/${id}/activation`)
      .send({ release: 2 })
      .expect(404);
  });
});
