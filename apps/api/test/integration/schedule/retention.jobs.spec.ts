import { randomUUID } from "node:crypto";
import { getDrizzleToken } from "@nestjs/drizzle";
import { LocksEvents, type LocksJobSkippedEvent } from "@nestjs/locks";
import { Test, type TestingModule } from "@nestjs/testing";
import { type SQL, sql } from "drizzle-orm";
import { Role } from "../../../src/domain/identity/enums.js";
import { AppModule } from "../../../src/frameworks/di/app.module.js";
import { WorkerInterpreterClient } from "../../../src/frameworks/interpreter/worker-interpreter.client.js";
import { RetentionJobs } from "../../../src/frameworks/schedule/retention.jobs.js";
import type { Database } from "../../../src/interface-adapters/persistence/interfaces.js";
import {
  emailToken,
  idempotencyKey,
  session,
  user,
} from "../../../src/interface-adapters/persistence/schema/index.js";
import { truncateAll } from "../../support/db.js";

const DAY_MS = 24 * 60 * 60 * 1_000;

interface IdRow {
  readonly id: string;
}

async function startInstance(): Promise<TestingModule> {
  const instance = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(WorkerInterpreterClient)
    .useValue({})
    .compile();
  instance.useLogger(false);
  await instance.init();
  return instance;
}

describe("the retention jobs, on two instances over one lock store", () => {
  let instances: TestingModule[];
  let db: Database;
  const skips: LocksJobSkippedEvent[] = [];

  beforeAll(async () => {
    const first = await startInstance();
    const second = await startInstance();
    instances = [first, second];
    db = first.get<Database>(getDrizzleToken());

    for (const instance of instances)
      instance
        .get(LocksEvents)
        .jobSkips$.subscribe((skipped) => skips.push(skipped));
  });

  afterAll(async () => {
    for (const instance of instances) await instance.close();
  });

  beforeEach(async () => {
    skips.length = 0;
    await truncateAll(db);
    await db.execute(sql`truncate table nest_workflows.instances cascade`);
  });

  const tick = async (job: (jobs: RetentionJobs) => Promise<void>) => {
    const runs = instances.map((instance) => job(instance.get(RetentionJobs)));
    await Promise.all(runs);
  };

  const skipped = () => skips.map(({ job, reason }) => ({ job, reason }));

  const ids = async (query: SQL) => {
    const result = await db.execute(query);
    const rows = result.rows as unknown as IdRow[];
    return rows.map((row) => row.id).sort((a, b) => a.localeCompare(b));
  };

  it("the_nightly_purge_deletes_the_instances_finished_over_30_days_ago_and_keeps_the_rest_on_one_instance", async () => {
    const old = Date.now() - 31 * DAY_MS;
    const recent = Date.now() - DAY_MS;
    await db.execute(sql`
      insert into nest_workflows.instances (id, workflow, version, status, signal_cursor, created_at, updated_at)
      values
        ('completed-long-ago', 'run', 1, 'completed', 0, ${old}, ${old}),
        ('failed-long-ago', 'run', 1, 'failed', 0, ${old}, ${old}),
        ('completed-yesterday', 'run', 1, 'completed', 0, ${recent}, ${recent}),
        ('waiting-for-a-person', 'run', 1, 'compensation_failed', 0, ${old}, ${old})
    `);

    await tick((jobs) => jobs.purgeWorkflows());

    expect(await ids(sql`select id from nest_workflows.instances`)).toEqual([
      "completed-yesterday",
      "waiting-for-a-person",
    ]);
    expect(skipped()).toEqual([
      { job: "RetentionJobs.purgeWorkflows", reason: "ownership-unavailable" },
    ]);
  });

  it("the_nightly_inbox_prune_deletes_the_records_over_30_days_old_and_keeps_the_rest_on_one_instance", async () => {
    const old = Date.now() - 31 * DAY_MS;
    const recent = Date.now() - DAY_MS;
    await db.execute(sql`
      insert into nest_outbox.inbox (consumer, message_id, processed_at)
      values ('automation', 'handled-long-ago', ${old}), ('automation', 'handled-yesterday', ${recent})
    `);

    await tick((jobs) => jobs.pruneInbox());

    expect(
      await ids(sql`select message_id as id from nest_outbox.inbox`),
    ).toEqual(["handled-yesterday"]);
    expect(skipped()).toEqual([
      { job: "RetentionJobs.pruneInbox", reason: "ownership-unavailable" },
    ]);
  });

  it("the_hourly_idempotency_prune_deletes_the_expired_keys_and_keeps_the_live_ones_on_one_instance", async () => {
    const record = { fingerprint: "f", owner: null, response: null };
    await db.insert(idempotencyKey).values([
      {
        ...record,
        keyHash: "expired",
        key: "expired",
        expiresAt: Date.now() - 1_000,
      },
      {
        ...record,
        keyHash: "live",
        key: "live",
        expiresAt: Date.now() + DAY_MS,
      },
    ]);

    await tick((jobs) => jobs.pruneIdempotencyKeys());

    expect(await ids(sql`select key as id from idempotency_key`)).toEqual([
      "live",
    ]);
    expect(skipped()).toEqual([
      {
        job: "RetentionJobs.pruneIdempotencyKeys",
        reason: "ownership-unavailable",
      },
    ]);
  });

  it("the_nightly_identity_prune_deletes_the_expired_sessions_and_email_tokens_and_keeps_the_live_ones_on_one_instance", async () => {
    const userId = randomUUID();
    const now = new Date();
    const expired = new Date(now.getTime() - 1_000);
    const live = new Date(now.getTime() + DAY_MS);
    await db.insert(user).values({
      id: userId,
      email: "user@example.com",
      name: "User",
      role: Role.Viewer,
    });
    const started = { userId, createdAt: now, lastActiveAt: now };
    await db.insert(session).values([
      { ...started, id: "expired-session", expiresAt: expired },
      { ...started, id: "live-session", expiresAt: live },
    ]);
    const issued = {
      userId,
      purpose: "passwordReset",
      email: "user@example.com",
      createdAt: now,
    };
    await db.insert(emailToken).values([
      { ...issued, id: "expired-token", expiresAt: expired },
      { ...issued, id: "live-token", expiresAt: live },
    ]);

    await tick((jobs) => jobs.pruneExpiredIdentity());

    expect(await ids(sql`select id from session`)).toEqual(["live-session"]);
    expect(await ids(sql`select id from email_token`)).toEqual(["live-token"]);
    expect(skipped()).toEqual([
      {
        job: "RetentionJobs.pruneExpiredIdentity",
        reason: "ownership-unavailable",
      },
    ]);
  });
});
