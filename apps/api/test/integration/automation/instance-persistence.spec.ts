import { OutboxRelay } from '@nestjs/outbox';
import { WorkflowWorker } from '@nestjs/workflows';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { DrizzleEventRepository } from '../../../src/interface-adapters/persistence/repositories/drizzle-event.repository.js';
import {
  ProcessRunner,
  WorkflowInstanceRepository,
} from '../../../src/application/automation/instances/ports.js';
import { EventOriginKind } from '../../../src/domain/automation/events/enums.js';
import { Event } from '../../../src/domain/automation/events/event.js';
import type { WorkflowInstance } from '../../../src/domain/automation/instances/workflow-instance.js';
import type { ProcessRun } from '../../../src/domain/automation/language/interfaces.js';
import { ProcessExited } from '../../../src/domain/automation/language/results/process-exited.js';
import type { ProcessResult } from '../../../src/domain/automation/language/results/process-result.js';
import { StaleWriteError } from '../../../src/domain/errors.js';
import { Role } from '../../../src/domain/identity/enums.js';
import { authHeaders, createUser, signIn } from '../../support/auth-helpers.js';
import { createTestApp, type TestApp } from '../../support/create-test-app.js';
import { inTransaction, truncateAll } from '../../support/db.js';

class RecordingProcessRunner extends ProcessRunner {
  readonly runs: ProcessRun[] = [];

  async run(run: ProcessRun): Promise<ProcessResult> {
    this.runs.push(run);
    return new ProcessExited({ id: run.id, code: 0, stdout: '', stderr: '' });
  }
}

function documentOf(name: string, body: unknown): string {
  return JSON.stringify({
    document: { dsl: '1.0.3', namespace: 'default', name, version: '1.0.0' },
    do: body,
  });
}

describe('instance persistence and reactions', () => {
  let t: TestApp;
  let editor: Record<string, string>;
  const processes = new RecordingProcessRunner();

  beforeAll(async () => {
    t = await createTestApp((builder) =>
      builder.overrideProvider(ProcessRunner).useValue(processes),
    );
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateAll(t.db);
    processes.runs.length = 0;
    await createUser(t, { email: 'editor@example.com', role: Role.Editor });
    editor = authHeaders(await signIn(t.server, 'editor@example.com'));
  });

  async function started(name: string, body: unknown): Promise<string> {
    await request(t.server)
      .post('/api/v1/workflows')
      .set(editor)
      .type('application/json')
      .send(documentOf(name, body))
      .expect(201);
    const response = await request(t.server)
      .post(`/api/v1/workflows/default/${name}/instances`)
      .set(editor)
      .send({})
      .expect(201);
    return String(response.body.id);
  }

  async function load(id: string): Promise<WorkflowInstance | null> {
    const instances = t.app.get(WorkflowInstanceRepository);
    return inTransaction(t.app, () => instances.find(id));
  }

  it('a_saved_instance_comes_back_with_only_its_active_tasks', async () => {
    const id = await started('pets', [
      { done: { set: { done: true } } },
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
            retry: { delay: { minutes: 5 }, limit: { attempt: { count: 3 } } },
          },
        },
      },
    ]);
    await t.app.get(WorkflowWorker).drain();

    const reloaded = await load(id);

    const names = reloaded?.tasks.map((task) => task.name);
    expect(reloaded?.phase.name).toBe('waiting');
    expect(names).toEqual(['pets', 'attempt']);
  });

  it('a_save_from_a_stale_copy_is_refused', async () => {
    const id = await started('greet', [{ a: { set: { a: 1 } } }]);
    const instances = t.app.get(WorkflowInstanceRepository);
    const first = await load(id);
    const second = await load(id);

    if (first === null || second === null) throw new Error('instance');

    first.fault(new Date());
    second.fault(new Date());
    await inTransaction(t.app, () => instances.save(first));
    const stale = inTransaction(t.app, () => instances.save(second));

    await expect(stale).rejects.toThrow(StaleWriteError);
  });

  it('a_detached_process_runs_once_from_the_outbox_after_its_task_completes', async () => {
    const id = await started('notify', [
      { ping: { run: { shell: { command: 'echo hi' }, await: false } } },
    ]);
    await t.app.get(WorkflowWorker).drain();

    const queued = await t.db.execute(
      sql`select topic, key from nest_outbox.messages where topic = 'process-detached'`,
    );
    await t.app.get(OutboxRelay).runOnce();
    const instance = await load(id);

    expect(queued.rows).toHaveLength(1);
    expect(processes.runs).toHaveLength(1);
    expect(processes.runs[0]?.process).toEqual({ command: 'echo hi' });
    expect(instance?.phase.name).toBe('completed');
  });

  it('a_detached_sub_workflow_starts_from_the_outbox_with_a_parent_origin', async () => {
    await request(t.server)
      .post('/api/v1/workflows')
      .set(editor)
      .type('application/json')
      .send(documentOf('archive', [{ keep: { set: { kept: true } } }]))
      .expect(201);
    await started('orders', [
      {
        archive: {
          run: {
            workflow: {
              namespace: 'default',
              name: 'archive',
              version: '1.0.0',
            },
            await: false,
          },
        },
      },
    ]);
    await t.app.get(WorkflowWorker).drain();

    await t.app.get(OutboxRelay).runOnce();
    await t.app.get(WorkflowWorker).drain();
    const children = await t.db.execute(
      sql`select phase, origin from workflow_instance where name = 'archive'`,
    );

    const [child] = children.rows as {
      phase: string;
      origin: { kind: string };
    }[];
    expect(child?.phase).toBe('completed');
    expect(child?.origin.kind).toBe('parent');
  });

  it('an_event_with_a_source_and_id_already_stored_is_kept_once', async () => {
    const id = await started('greet', [{ a: { set: { a: 1 } } }]);
    await t.app.get(WorkflowWorker).drain();
    const before = await t.db.execute(
      sql`select count(*)::int as count from event where origin_instance_id = ${id}`,
    );
    const [counted] = before.rows as { count: number }[];
    const events = t.app.get(DrizzleEventRepository);
    const stored = await t.db.execute(
      sql`select source, event_id from event where origin_instance_id = ${id} limit 1`,
    );
    const [existing] = stored.rows as { source: string; event_id: string }[];
    const duplicate = Event.lifecycle({
      source: existing?.source ?? '',
      type: 'io.serverlessworkflow.workflow.started.v1',
      time: new Date(),
      data: {},
      origin: {
        kind: EventOriginKind.Lifecycle,
        workflowId: id,
        instanceId: id,
      },
      sequence: Number(existing?.event_id ?? '0'),
      acceptedAt: new Date(),
    });
    await inTransaction(t.app, () => events.addAll([duplicate]));
    const after = await t.db.execute(
      sql`select count(*)::int as count from event where origin_instance_id = ${id}`,
    );

    const [recounted] = after.rows as { count: number }[];
    expect(recounted?.count).toBe(counted?.count);
  });
});
