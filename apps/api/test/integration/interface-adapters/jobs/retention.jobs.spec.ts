import { getDrizzleToken } from "@nestjs/drizzle";
import { LocksEvents, type LocksJobSkippedEvent } from "@nestjs/locks";
import { Test, type TestingModule } from "@nestjs/testing";
import { type SQL, sql } from "drizzle-orm";
import { ApiModule } from "../../../../src/frameworks/di/api.module.js";
import { AutomationBackgroundModule } from "../../../../src/frameworks/di/automation-background.module.js";
import { IdentityBackgroundModule } from "../../../../src/frameworks/di/identity-background.module.js";
import { PiscinaInterpreterClient } from "../../../../src/frameworks/interpreter/piscina-interpreter.client.js";
import { RetentionJobs } from "../../../../src/interface-adapters/jobs/retention.jobs.js";
import type { Database } from "../../../../src/interface-adapters/persistence/interfaces.js";
import { truncateAll } from "../../../support/db.js";

const DAY_MS = 24 * 60 * 60 * 1_000;

interface IdRow {
  readonly id: string;
}

async function startInstance(): Promise<TestingModule> {
  const instance = await Test.createTestingModule({
    imports: [ApiModule, IdentityBackgroundModule, AutomationBackgroundModule],
  })
    .overrideProvider(PiscinaInterpreterClient)
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

  it("the_nightly_purge_deletes_the_dead_letters_failed_over_14_days_ago_and_keeps_the_rest_on_one_instance", async () => {
    const old = Date.now() - 15 * DAY_MS;
    const recent = Date.now() - DAY_MS;
    await db.execute(sql`
      insert into nest_outbox.dead_letters (id, seq, topic, payload, headers, key, created_at, attempts, last_error, history, reason, failed_at)
      values
        ('failed-long-ago', 1, 'delivery.requested', '{}', '{}', null, ${old}, 36, 'refused', '[]', 'exhausted', ${old}),
        ('failed-yesterday', 2, 'delivery.requested', '{}', '{}', null, ${recent}, 36, 'refused', '[]', 'exhausted', ${recent})
    `);

    await tick((jobs) => jobs.purgeDeadLetters());

    expect(await ids(sql`select id from nest_outbox.dead_letters`)).toEqual([
      "failed-yesterday",
    ]);
    expect(skipped()).toEqual([
      {
        job: "RetentionJobs.purgeDeadLetters",
        reason: "ownership-unavailable",
      },
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
});
