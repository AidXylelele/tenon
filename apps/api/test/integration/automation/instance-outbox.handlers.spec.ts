import { Outbox, OutboxRelay } from '@nestjs/outbox';
import { WorkflowWorker } from '@nestjs/workflows';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { ProcessRunner } from '../../../src/application/automation/instances/ports.js';
import type { ProcessRun } from '../../../src/domain/automation/language/interfaces.js';
import { ProcessExited } from '../../../src/domain/automation/language/results/process-exited.js';
import type { ProcessResult } from '../../../src/domain/automation/language/results/process-result.js';
import { Role } from '../../../src/domain/identity/enums.js';
import { DomainEventTopic } from '../../../src/interface-adapters/enums.js';
import { authHeaders, createUser, signIn } from '../../support/auth-helpers.js';
import { createTestApp, type TestApp } from '../../support/create-test-app.js';
import { truncateAll } from '../../support/db.js';

// Finds no capacity until it is opened, as a full bulkhead would.
class GatedProcessRunner extends ProcessRunner {
  open = false;
  readonly runs: ProcessRun[] = [];

  async run(run: ProcessRun): Promise<ProcessResult | null> {
    if (!this.open) return null;

    this.runs.push(run);
    return new ProcessExited({ id: run.id, code: 0, stdout: '', stderr: '' });
  }
}

function documentOf(name: string, version: string, body: unknown): string {
  return JSON.stringify({
    document: { dsl: '1.0.3', namespace: 'default', name, version },
    do: body,
  });
}

describe('the outbox handlers of the instances', () => {
  let t: TestApp;
  let editor: Record<string, string>;
  const processes = new GatedProcessRunner();

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
    processes.open = false;
    processes.runs.length = 0;
    await createUser(t, { email: 'editor@example.com', role: Role.Editor });
    editor = authHeaders(await signIn(t.server, 'editor@example.com'));
  });

  async function publish(name: string, version: string, body: unknown) {
    await request(t.server)
      .post('/api/v1/workflows')
      .set(editor)
      .type('application/json')
      .send(documentOf(name, version, body))
      .expect(201);
  }

  async function start(name: string): Promise<string> {
    const response = await request(t.server)
      .post(`/api/v1/workflows/default/${name}/instances`)
      .set(editor)
      .send({})
      .expect(201);
    return String(response.body.id);
  }

  async function countOf(table: string, topic: string): Promise<number> {
    const counted = await t.db.execute(
      sql`select count(*)::int as count from ${sql.identifier('nest_outbox')}.${sql.identifier(table)} where topic = ${topic}`,
    );
    const [row] = counted.rows as { count: number }[];
    return row?.count ?? 0;
  }

  it('a_detached_process_that_found_no_capacity_stays_queued_for_a_retry', async () => {
    await publish('notify', '1.0.0', [
      { ping: { run: { shell: { command: 'echo hi' }, await: false } } },
    ]);
    await start('notify');
    await t.app.get(WorkflowWorker).drain();

    await t.app.get(OutboxRelay).runOnce();
    const queued = await countOf('messages', DomainEventTopic.ProcessDetached);
    const dead = await countOf(
      'dead_letters',
      DomainEventTopic.ProcessDetached,
    );

    expect(queued).toBe(1);
    expect(dead).toBe(0);
    expect(processes.runs).toHaveLength(0);
  });

  it('a_malformed_message_is_dead_lettered_at_once', async () => {
    const outbox = t.app.get(Outbox);

    await t.db.transaction(async (tx) => {
      await outbox.add(tx, {
        topic: DomainEventTopic.WorkflowDetached,
        key: 'malformed',
        payload: {},
      });
    });
    await t.app.get(OutboxRelay).runOnce();
    const queued = await countOf('messages', DomainEventTopic.WorkflowDetached);
    const dead = await countOf(
      'dead_letters',
      DomainEventTopic.WorkflowDetached,
    );

    expect(queued).toBe(0);
    expect(dead).toBe(1);
  });

  it('a_detached_sub_workflow_runs_the_version_resolved_when_its_task_started', async () => {
    await publish('archive', '1.0.0', [{ keep: { set: { kept: 1 } } }]);
    await publish('orders', '1.0.0', [
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
    await start('orders');
    await t.app.get(WorkflowWorker).drain();

    await publish('archive', '2.0.0', [{ keep: { set: { kept: 2 } } }]);
    await t.app.get(OutboxRelay).runOnce();
    await t.app.get(WorkflowWorker).drain();
    const children = await request(t.server)
      .get('/api/v1/instances?name=archive')
      .set(editor)
      .expect(200);

    const [child] = children.body.items as { version: string; phase: string }[];
    expect(child?.version).toBe('1.0.0');
    expect(child?.phase).toBe('completed');
  });
});
