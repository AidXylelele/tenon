import { OutboxRelay } from '@nestjs/outbox';
import {
  ManualWorkflowClock,
  WORKFLOWS_MODULE_OPTIONS,
  WorkflowClient,
  WorkflowWorker,
} from '@nestjs/workflows';
import request from 'supertest';
import { ServiceCaller } from '../../../src/application/automation/instances/ports.js';
import type { ServiceCall } from '../../../src/domain/automation/language/interfaces.js';
import { ServiceResponded } from '../../../src/domain/automation/language/results/service-responded.js';
import type { ServiceResult } from '../../../src/domain/automation/language/results/service-result.js';
import { Role } from '../../../src/domain/identity/enums.js';
import { EngineClock } from '../../../src/interface-adapters/workflows/runs/engine.clock.js';
import { authHeaders, createUser, signIn } from '../../support/auth-helpers.js';
import { createTestApp, type TestApp } from '../../support/create-test-app.js';
import { truncateAll } from '../../support/db.js';

// The first call finds no capacity, as a full bulkhead would; the next ones are answered.
class OnceBusyServiceCaller extends ServiceCaller {
  calls = 0;

  async callAll(
    calls: readonly ServiceCall[],
  ): Promise<readonly ServiceResult[]> {
    this.calls += 1;

    if (this.calls === 1) return [];

    return calls.map(
      (call) =>
        new ServiceResponded({
          id: call.id,
          status: 200,
          headers: {},
          content: { answered: true },
          body: '',
          request: {},
          authorization: null,
        }),
    );
  }
}

function documentOf(name: string, body: unknown): string {
  return JSON.stringify({
    document: { dsl: '1.0.3', namespace: 'default', name, version: '1.0.0' },
    do: body,
  });
}

const absent = {
  run: {
    workflow: { namespace: 'default', name: 'absent', version: '1.0.0' },
  },
};

describe('the engine run of an instance', () => {
  let t: TestApp;
  let clock: ManualWorkflowClock;
  let editor: Record<string, string>;
  const services = new OnceBusyServiceCaller();

  beforeAll(async () => {
    clock = new ManualWorkflowClock();
    const engineClock = new EngineClock(clock);
    t = await createTestApp((builder) =>
      builder
        .overrideProvider(EngineClock)
        .useValue(engineClock)
        .overrideProvider(WORKFLOWS_MODULE_OPTIONS)
        .useValue({
          clock,
          worker: {
            enabled: false,
            leaseDuration: '120s',
            shutdownTimeout: 50,
          },
          journal: { maxEntries: 20 },
        })
        .overrideProvider(ServiceCaller)
        .useValue(services),
    );
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateAll(t.db);
    services.calls = 0;
    await createUser(t, { email: 'editor@example.com', role: Role.Editor });
    editor = authHeaders(await signIn(t.server, 'editor@example.com'));
  });

  async function publish(text: string): Promise<void> {
    await request(t.server)
      .post('/api/v1/workflows')
      .set(editor)
      .type('application/json')
      .send(text)
      .expect(201);
  }

  async function started(name: string, body: unknown): Promise<string> {
    await publish(documentOf(name, body));
    const response = await request(t.server)
      .post(`/api/v1/workflows/default/${name}/instances`)
      .set(editor)
      .send({})
      .expect(201);
    return String(response.body.id);
  }

  async function drain(): Promise<void> {
    await t.app.get(WorkflowWorker).drain();
  }

  async function phaseOf(id: string): Promise<string> {
    const read = await request(t.server)
      .get(`/api/v1/instances/${id}`)
      .set(editor)
      .expect(200);
    return String(read.body.phase);
  }

  async function runOf(id: string): Promise<string | undefined> {
    const status = await t.app.get(WorkflowClient).getStatus(id);
    return status?.status;
  }

  it('a_refused_sub_workflow_inside_a_try_lets_the_instance_go_on_and_the_run_end', async () => {
    const id = await started('guarded', [
      {
        guard: {
          try: [{ invoice: absent }],
          catch: { do: [{ fallback: { set: { fallback: true } } }] },
        },
      },
    ]);

    await drain();

    expect(await phaseOf(id)).toBe('completed');
    expect(await runOf(id)).toBe('completed');
  });

  it('a_refused_sub_workflow_faults_the_instance_and_ends_the_run', async () => {
    const id = await started('unguarded', [{ invoice: absent }]);

    await drain();

    expect(await phaseOf(id)).toBe('faulted');
    expect(await runOf(id)).toBe('completed');
  });

  it('a_detached_sub_workflow_completes_its_task_and_its_child_starts_from_the_outbox', async () => {
    await publish(documentOf('archive', [{ keep: { set: { kept: true } } }]));
    const id = await started('orders', [
      {
        archive: {
          run: {
            workflow: {
              namespace: 'default',
              name: 'archive',
              version: 'latest',
            },
            await: false,
          },
        },
      },
    ]);

    await drain();
    await t.app.get(OutboxRelay).runOnce();
    await drain();
    const children = await request(t.server)
      .get('/api/v1/instances?name=archive')
      .set(editor)
      .expect(200);

    const [child] = children.body.items as { id: string; phase: string }[];
    expect(await phaseOf(id)).toBe('completed');
    expect(await runOf(id)).toBe('completed');
    expect(child?.phase).toBe('completed');
  });

  it('work_that_found_no_capacity_sleeps_and_runs_again', async () => {
    const id = await started('busy', [
      {
        fetch: {
          call: 'http',
          with: { method: 'get', endpoint: 'https://busy.example/' },
        },
      },
    ]);

    await drain();
    const deferred = await phaseOf(id);
    clock.advance('1s');
    await drain();

    expect(deferred).toBe('running');
    expect(await phaseOf(id)).toBe('completed');
    expect(services.calls).toBe(2);
  });

  it('a_run_the_engine_fails_faults_the_instance_through_its_compensation', async () => {
    const id = await started('stubborn', [
      {
        attempt: {
          try: [
            {
              fail: {
                raise: {
                  error: {
                    type: 'https://serverlessworkflow.io/spec/1.0.0/errors/runtime',
                    status: 500,
                  },
                },
              },
            },
          ],
          catch: {
            errors: { with: { status: 500 } },
            retry: {
              delay: { seconds: 1 },
              limit: { attempt: { count: 50 } },
            },
          },
        },
      },
    ]);

    await drain();

    for (let park = 0; park < 15; park += 1) {
      clock.advance('1s');
      await drain();
    }

    expect(await phaseOf(id)).toBe('faulted');
    expect(await runOf(id)).toBe('failed');
  });
});
