import { OutboxRelay } from '@nestjs/outbox';
import { ManualWorkflowClock, WorkflowWorker } from '@nestjs/workflows';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { MockAgent } from 'undici';
import type { JsonObject } from '../../src/domain/automation/json.js';
import { EndpointDispatcher } from '../../src/frameworks/undici/endpoint-dispatcher.js';
import { EngineClock } from '../../src/interface-adapters/workflows/runs/engine.clock.js';
import { aDocument, type DocumentHeader } from './builders.js';
import { createTestApp, type TestApp } from './create-test-app.js';
import { truncateAll } from './db.js';

// A test app whose engine only moves when the test drives it: a manual clock, no worker of its
// own, and outbound calls answered by a MockAgent.
export interface RunApp {
  readonly t: TestApp;
  readonly clock: ManualWorkflowClock;
  readonly agent: MockAgent;
}

export async function createRunApp(): Promise<RunApp> {
  const clock = new ManualWorkflowClock();
  const engineClock = new EngineClock(clock);
  const agent = new MockAgent();
  agent.disableNetConnect();
  const t = await createTestApp((builder) =>
    builder
      .overrideProvider(EndpointDispatcher)
      .useValue(agent)
      .overrideProvider(EngineClock)
      .useValue(engineClock),
  );
  return { t, clock, agent };
}

// The platform's tables and the engine's runs, so no run of an earlier test wakes up later.
export async function resetRuns(t: TestApp): Promise<void> {
  await truncateAll(t.db);
  await t.db.execute(
    sql`truncate table nest_workflows.instances, nest_workflows.journal, nest_workflows.signals, nest_workflows.waits cascade`,
  );
}

// Runs every due engine execution until none is left.
export async function drain(t: TestApp): Promise<number> {
  const worker = t.app.get(WorkflowWorker);
  let total = 0;

  for (let pass = 0; pass < 50; pass += 1) {
    const ran = await worker.drain();
    total += ran;

    if (ran === 0) break;
  }

  return total;
}

// Delivers the outbox: what the engine learns after a commit (cancel, resume, delete).
export async function relay(t: TestApp): Promise<void> {
  await t.app.get(OutboxRelay).runOnce();
}

export async function engineRunCount(t: TestApp, id: string): Promise<number> {
  const result = await t.db.execute(
    sql`select count(*)::int as count from nest_workflows.instances where id = ${id}`,
  );
  const [row] = result.rows as { count: number }[];
  return row?.count ?? 0;
}

export async function progressRowCount(
  t: TestApp,
  id: string,
): Promise<number> {
  const result = await t.db.execute(
    sql`select count(*)::int as count from task_progress where instance_id = ${id}`,
  );
  const [row] = result.rows as { count: number }[];
  return row?.count ?? 0;
}

export async function publish(
  t: TestApp,
  headers: Record<string, string>,
  document: JsonObject,
): Promise<void> {
  const response = await request(t.server)
    .post('/api/v1/workflows')
    .set(headers)
    .send(document);

  // 201 for a new version, 200 for the same document again.
  expect([200, 201]).toContain(response.status);
}

export interface Started {
  readonly id: string;
  readonly body: Record<string, unknown>;
}

export async function start(
  t: TestApp,
  headers: Record<string, string>,
  body: JsonObject = { input: {} },
  workflow = 'sales/route-lead',
): Promise<Started> {
  const response = await request(t.server)
    .post(`/api/v1/workflows/${workflow}/instances`)
    .set(headers)
    .send(body)
    .expect(201);
  const started = response.body as Record<string, unknown>;
  const id = String(started.id);
  return { id, body: started };
}

export interface InstanceBody {
  readonly id: string;
  readonly phase: string;
  readonly version: string;
  readonly trigger: string;
  readonly input: unknown;
  readonly output: unknown;
  readonly error: Record<string, unknown> | null;
  readonly originId: string | null;
  readonly starterId: string | null;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly endedAt: string | null;
}

export async function instanceOf(
  t: TestApp,
  headers: Record<string, string>,
  id: string,
): Promise<InstanceBody> {
  const response = await request(t.server)
    .get(`/api/v1/instances/${id}`)
    .set(headers)
    .expect(200);
  return response.body as InstanceBody;
}

export interface TaskBody {
  readonly execution: string;
  readonly reference: string;
  readonly name: string;
  readonly status: string;
  readonly input: unknown;
  readonly output: unknown;
  readonly error: Record<string, unknown> | null;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly attempt: number;
  readonly retryAt: string | null;
}

export async function tasksOf(
  t: TestApp,
  headers: Record<string, string>,
  id: string,
): Promise<TaskBody[]> {
  const response = await request(t.server)
    .get(`/api/v1/instances/${id}/tasks?limit=500`)
    .set(headers)
    .expect(200);
  return response.body.items as TaskBody[];
}

export const namesOf = (tasks: readonly TaskBody[]): string[] =>
  tasks.map((task) => task.name);

export const statusesOf = (tasks: readonly TaskBody[]): string[] =>
  tasks.map((task) => `${task.name}:${task.status}`);

// A version that sets a value, waits an hour, then adds another.
export const aWaitingDocument = (header: DocumentHeader = {}): JsonObject =>
  aDocument(header, [
    { before: { set: { step: 'before' } } },
    { pause: { wait: { hours: 1 } } },
    { after: { set: { step: 'after', done: true } } },
  ]);

// Polls until the condition holds, for a run that drains in the background.
export async function eventually(
  condition: () => Promise<boolean>,
  timeoutMs = 5_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await condition()) return;

    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error('The condition never held');
}
