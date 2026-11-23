import { OutboxRelay } from "@nestjs/outbox";
import type { TestingModuleBuilder } from "@nestjs/testing";
import { sql } from "drizzle-orm";
import request, { type Response } from "supertest";
import type { JsonObject } from "../../src/domain/automation/interfaces.js";
import { AddressPolicy } from "../../src/frameworks/network/address-policy.js";
import { aDocument, type DocumentHeader } from "./builders.js";
import { createTestApp, type TestApp } from "./create-test-app.js";
import { truncateAll } from "./db.js";
import type { Page } from "./bodies.js";

const DURATION = /^(\d+)(ms|s|m|h|d)$/;
const UNIT_MS: Readonly<Record<string, number>> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

class SystemTime {
  set(time: number): void {
    vi.setSystemTime(time);
  }

  advance(duration: string): number {
    const [, amount = "0", unit = "ms"] = DURATION.exec(duration) ?? [];
    const unitMs = UNIT_MS[unit] ?? 1;
    const moved = Date.now() + Number(amount) * unitMs;
    vi.setSystemTime(moved);
    return moved;
  }
}

export interface RunApp {
  readonly t: TestApp;
  readonly clock: SystemTime;
}

export async function createRunApp(
  customise: (builder: TestingModuleBuilder) => TestingModuleBuilder = (b) => b,
): Promise<RunApp> {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.UTC(2026, 0, 1));
  const policy = new AddressPolicy(["127.0.0.1"]);
  const t = await createTestApp((builder) =>
    customise(builder).overrideProvider(AddressPolicy).useValue(policy),
  );
  const clock = new SystemTime();
  return { t, clock };
}

export async function resetRuns(t: TestApp): Promise<void> {
  await truncateAll(t.db);
}

export async function drain(t: TestApp): Promise<number> {
  const outbox = t.app.get(OutboxRelay);
  let total = 0;

  for (let pass = 0; pass < 200; pass += 1) {
    const relayed = await outbox.runOnce();
    total += relayed.published;

    if (relayed.claimed === 0) break;
  }

  return total;
}

export async function relay(t: TestApp): Promise<void> {
  const relay = t.app.get(OutboxRelay);

  for (let round = 0; round < 100; round += 1) {
    const ran = await relay.runOnce();

    if (ran.claimed === 0) return;
  }
}

export async function pendingRunMessages(
  t: TestApp,
  id: string,
): Promise<number> {
  const result = await t.db.execute(
    sql`select count(*)::int as count from nest_outbox.messages where payload ->> 'instanceId' = ${id}`,
  );
  const [row] = result.rows as { count: number }[];
  return row?.count ?? 0;
}

export async function publishing(
  t: TestApp,
  headers: Record<string, string>,
  document: JsonObject,
): Promise<Response> {
  const header = document.document as Record<string, string>;
  const path = `/api/v1/workflows/${header.namespace}/${header.name}/draft`;
  const current = await request(t.server).get(path).set(headers);
  const etag =
    current.status === 200
      ? await draftSaved(t, headers, path, current, document)
      : await draftCreated(t, headers, path, document);
  return request(t.server).post(path).set(headers).set("If-Match", etag);
}

async function draftSaved(
  t: TestApp,
  headers: Record<string, string>,
  path: string,
  current: Response,
  document: JsonObject,
): Promise<string> {
  const source = JSON.stringify(document);
  const saved = await request(t.server)
    .put(path)
    .set(headers)
    .set("If-Match", String(current.headers.etag))
    .send({ source, layout: {} })
    .expect(200);
  return String(saved.headers.etag);
}

export async function publish(
  t: TestApp,
  headers: Record<string, string>,
  document: JsonObject,
): Promise<void> {
  const response = await publishing(t, headers, document);

  expect([200, 201]).toContain(response.status);
}

async function draftCreated(
  t: TestApp,
  headers: Record<string, string>,
  path: string,
  document: JsonObject,
): Promise<string> {
  const source = JSON.stringify(document);
  const created = await request(t.server)
    .put(path)
    .set(headers)
    .set("If-None-Match", "*")
    .send({ source, layout: {} })
    .expect(201);
  return String(created.headers.etag);
}

export interface Started {
  readonly id: string;
  readonly body: Record<string, unknown>;
}

export async function start(
  t: TestApp,
  headers: Record<string, string>,
  body: JsonObject = { input: {} },
  workflow = "sales/route-lead",
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
  readonly startedBy: { readonly id: string; readonly name: string } | null;
  readonly controls: readonly string[];
  readonly waits: readonly Record<string, unknown>[];
  readonly cancelReason: string | null;
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
  readonly error: Record<string, unknown> | null;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly attempt: number;
  readonly input: unknown;
  readonly output: unknown;
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
  return (response.body as Page<TaskBody>).items;
}

export const namesOf = (tasks: readonly TaskBody[]): string[] =>
  tasks.map((task) => task.name);

export const statusesOf = (tasks: readonly TaskBody[]): string[] =>
  tasks.map((task) => `${task.name}:${task.status}`);

export const aWaitingDocument = (header: DocumentHeader = {}): JsonObject =>
  aDocument(header, [
    { before: { set: { step: "before" } } },
    { pause: { wait: { hours: 1 } } },
    { after: { set: { step: "after", done: true } } },
  ]);

export async function eventually(
  condition: () => Promise<boolean>,
  timeoutMs = 5_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await condition()) return;

    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error("The condition never held");
}
