import { sql } from "drizzle-orm";
import { InstanceOrder } from "../../../../../src/application/automation/instances/enums.js";
import type {
  CountWindow,
  InstanceFilter,
  InstancePageRequest,
} from "../../../../../src/application/automation/instances/interfaces.js";
import { InstanceQueries } from "../../../../../src/application/automation/instances/queries.js";
import {
  Phase,
  WaitKind,
} from "../../../../../src/domain/automation/instances/enums.js";
import type { JsonObject } from "../../../../../src/domain/automation/interfaces.js";
import {
  createPersistenceTest,
  instanceQueries,
  type PersistenceTest,
} from "../../../../support/create-persistence-test.js";
import {
  aPublisher,
  aRunRow,
  aWorkflowRow,
  truncateRuns,
  type WorkflowRows,
} from "../../../../support/run-rows.js";

const at = (iso: string): Date => new Date(iso);

const HOURS = [
  at("2026-03-01T00:00:00.000Z"),
  at("2026-03-01T01:00:00.000Z"),
  at("2026-03-01T02:00:00.000Z"),
];

const END = at("2026-03-01T03:00:00.000Z");

const windowOf = (overrides: Partial<CountWindow> = {}): CountWindow => ({
  buckets: HOURS,
  to: END,
  previousFrom: null,
  namespace: null,
  name: null,
  tests: false,
  ...overrides,
});

const ANY_RUN: InstanceFilter = {
  namespace: null,
  name: null,
  version: null,
  phases: [],
  from: null,
  to: null,
  tests: false,
};

const pageOf = (
  filter: Partial<InstanceFilter> = {},
  request: Partial<InstancePageRequest> = {},
): InstancePageRequest => ({
  filter: { ...ANY_RUN, ...filter },
  order: InstanceOrder.Started,
  page: 1,
  limit: 50,
  ...request,
});

describe("PostgresInstanceQueries counting runs", () => {
  let t: PersistenceTest;
  let queries: InstanceQueries;
  let routeLead: WorkflowRows;
  let digest: WorkflowRows;

  beforeAll(async () => {
    t = await createPersistenceTest(instanceQueries);
    queries = t.module.get(InstanceQueries);
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateRuns(t.db);
    const publisherId = await aPublisher(t.db);
    routeLead = await aWorkflowRow(t.db, publisherId, { name: "route-lead" });
    digest = await aWorkflowRow(t.db, publisherId, {
      namespace: "ops",
      name: "digest",
    });
  });

  const ran = (
    workflow: WorkflowRows,
    phase: Phase,
    startedAt: string | null,
    test = false,
  ) => {
    const started = startedAt === null ? null : at(startedAt);
    return aRunRow(t.db, workflow, { phase, startedAt: started, test });
  };

  it("counts_each_run_in_the_bucket_its_start_falls_in_and_totals_the_window", async () => {
    await ran(routeLead, Phase.Completed, "2026-03-01T00:30:00.000Z");
    await ran(routeLead, Phase.Faulted, "2026-03-01T00:59:59.999Z");
    await ran(digest, Phase.Completed, "2026-03-01T01:00:00.000Z");
    await ran(routeLead, Phase.Running, "2026-03-01T02:30:00.000Z");
    await ran(routeLead, Phase.Completed, "2026-03-01T03:00:00.000Z");
    await ran(routeLead, Phase.Completed, "2026-02-28T23:59:59.999Z");

    const hourly = windowOf();
    const counted = await queries.counts(hourly);

    const buckets = counted.buckets.map((bucket) => [
      bucket.start.toISOString(),
      bucket.counts,
    ]);
    expect(buckets).toEqual([
      [
        "2026-03-01T00:00:00.000Z",
        expect.arrayContaining([
          { phase: Phase.Completed, count: 1 },
          { phase: Phase.Faulted, count: 1 },
        ]),
      ],
      ["2026-03-01T01:00:00.000Z", [{ phase: Phase.Completed, count: 1 }]],
      ["2026-03-01T02:00:00.000Z", [{ phase: Phase.Running, count: 1 }]],
    ]);
    expect(counted.buckets[0]?.counts).toHaveLength(2);
    expect(counted.total).toHaveLength(3);
    expect(counted.total).toEqual(
      expect.arrayContaining([
        { phase: Phase.Completed, count: 2 },
        { phase: Phase.Faulted, count: 1 },
        { phase: Phase.Running, count: 1 },
      ]),
    );
    expect(counted.previous).toBeNull();
    expect(counted.to).toEqual(END);
  });

  it("buckets_of_uneven_lengths_count_by_the_edges_the_client_gave", async () => {
    const edges = [
      at("2026-03-29T00:00:00.000Z"),
      at("2026-03-29T00:30:00.000Z"),
      at("2026-03-29T23:00:00.000Z"),
    ];
    await ran(routeLead, Phase.Completed, "2026-03-29T00:29:59.999Z");
    await ran(routeLead, Phase.Completed, "2026-03-29T00:30:00.000Z");
    await ran(routeLead, Phase.Completed, "2026-03-29T22:59:59.999Z");
    await ran(routeLead, Phase.Completed, "2026-03-29T23:00:00.000Z");

    const to = at("2026-03-30T23:00:00.000Z");
    const uneven = windowOf({ buckets: edges, to });
    const counted = await queries.counts(uneven);

    const perBucket = counted.buckets.map((bucket) => bucket.counts);
    expect(perBucket).toEqual([
      [{ phase: Phase.Completed, count: 1 }],
      [{ phase: Phase.Completed, count: 2 }],
      [{ phase: Phase.Completed, count: 1 }],
    ]);
  });

  it("the_previous_window_is_totalled_apart_from_the_window", async () => {
    await ran(routeLead, Phase.Faulted, "2026-02-28T21:00:00.000Z");
    await ran(routeLead, Phase.Faulted, "2026-02-28T23:59:59.999Z");
    await ran(routeLead, Phase.Faulted, "2026-02-28T20:59:59.999Z");
    await ran(routeLead, Phase.Completed, "2026-03-01T00:00:00.000Z");
    const previousFrom = at("2026-02-28T21:00:00.000Z");

    const withPrevious = windowOf({ previousFrom });
    const counted = await queries.counts(withPrevious);

    expect(counted.previous).toEqual({
      from: previousFrom,
      counts: [{ phase: Phase.Faulted, count: 2 }],
    });
    expect(counted.total).toEqual([{ phase: Phase.Completed, count: 1 }]);
    expect(counted.buckets[0]?.counts).toEqual([
      { phase: Phase.Completed, count: 1 },
    ]);
  });

  it("test_runs_are_left_out_unless_asked_for", async () => {
    await ran(routeLead, Phase.Completed, "2026-03-01T00:10:00.000Z");
    await ran(routeLead, Phase.Completed, "2026-03-01T00:20:00.000Z", true);

    const real = windowOf();
    const all = windowOf({ tests: true });
    const without = await queries.counts(real);
    const including = await queries.counts(all);

    expect(without.total).toEqual([{ phase: Phase.Completed, count: 1 }]);
    expect(including.total).toEqual([{ phase: Phase.Completed, count: 2 }]);
  });

  it("a_workflow_filter_counts_only_that_workflows_runs", async () => {
    await ran(routeLead, Phase.Completed, "2026-03-01T00:10:00.000Z");
    await ran(digest, Phase.Faulted, "2026-03-01T00:20:00.000Z");
    await ran(digest, Phase.Running, "2026-02-01T00:20:00.000Z");

    const ofDigest = windowOf({ namespace: "ops", name: "digest" });
    const counted = await queries.counts(ofDigest);

    expect(counted.total).toEqual([{ phase: Phase.Faulted, count: 1 }]);
    expect(counted.live).toEqual([{ phase: Phase.Running, count: 1 }]);
  });

  it("runs_in_progress_now_are_counted_whenever_they_started", async () => {
    await ran(routeLead, Phase.Pending, null);
    await ran(routeLead, Phase.Running, "2025-12-01T00:00:00.000Z");
    await ran(routeLead, Phase.Waiting, "2026-03-01T00:10:00.000Z");
    await ran(routeLead, Phase.Suspended, "2026-03-01T00:20:00.000Z", true);
    await ran(routeLead, Phase.Completed, "2026-03-01T00:30:00.000Z");
    const hourly = windowOf();

    const counted = await queries.counts(hourly);

    expect(counted.live).toHaveLength(3);
    expect(counted.live).toEqual(
      expect.arrayContaining([
        { phase: Phase.Pending, count: 1 },
        { phase: Phase.Running, count: 1 },
        { phase: Phase.Waiting, count: 1 },
      ]),
    );
  });
});

describe("PostgresInstanceQueries listing runs", () => {
  let t: PersistenceTest;
  let queries: InstanceQueries;
  let workflow: WorkflowRows;
  let publisherId: string;

  beforeAll(async () => {
    t = await createPersistenceTest(instanceQueries);
    queries = t.module.get(InstanceQueries);
  });

  afterAll(async () => {
    await t.close();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(async () => {
    await truncateRuns(t.db);
    publisherId = await aPublisher(t.db, "Ada");
    workflow = await aWorkflowRow(t.db, publisherId, { name: "route-lead" });
  });

  const ran = (
    phase: Phase,
    startedAt: string | null,
    endedAt: string | null = null,
    test = false,
  ) => {
    const started = startedAt === null ? null : at(startedAt);
    const ended = endedAt === null ? null : at(endedAt);
    const createdAt = started ?? at("2026-03-02T00:00:00.000Z");
    return aRunRow(t.db, workflow, {
      phase,
      startedAt: started,
      endedAt: ended,
      createdAt,
      test,
    });
  };

  it("lists_the_newest_start_first_with_runs_not_yet_begun_on_top_page_by_page", async () => {
    const older = await ran(
      Phase.Completed,
      "2026-03-01T00:00:00.000Z",
      "2026-03-01T00:00:01.000Z",
    );
    const newer = await ran(
      Phase.Completed,
      "2026-03-01T01:00:00.000Z",
      "2026-03-01T01:00:01.000Z",
    );
    const pending = await ran(Phase.Pending, null);
    const firstPage = pageOf({}, { limit: 2 });
    const secondPage = pageOf({}, { limit: 2, page: 2 });

    const first = await queries.list(firstPage);
    const second = await queries.list(secondPage);

    const firstIds = first.items.map((item) => item.id);
    const secondIds = second.items.map((item) => item.id);
    expect(firstIds).toEqual([pending, newer]);
    expect(secondIds).toEqual([older]);
    expect(first.total).toBe(3);
    expect(first.exact).toBe(true);
    expect(second.total).toBe(3);
  });

  it("a_total_past_ten_thousand_is_given_as_ten_thousand_and_not_exact", async () => {
    await t.db.execute(
      sql`insert into workflow_instance (id, workflow_id, version_id, trigger, input, phase, created_at, started_at, ended_at)
        select gen_random_uuid(), ${workflow.workflowId}, ${workflow.versionId}, 'manual', '{}', 'completed', now(), now(), now()
        from generate_series(1, 10001)`,
    );
    const request = pageOf({}, { limit: 1 });

    const listed = await queries.list(request);

    expect(listed.total).toBe(10_000);
    expect(listed.exact).toBe(false);
    expect(listed.items).toHaveLength(1);
  });

  it("filters_by_several_phases_a_half_open_start_window_and_leaves_out_test_runs", async () => {
    const failed = await ran(
      Phase.Faulted,
      "2026-03-01T00:00:00.000Z",
      "2026-03-01T00:01:00.000Z",
    );
    const running = await ran(Phase.Running, "2026-03-01T00:59:59.999Z");
    await ran(Phase.Waiting, "2026-03-01T01:00:00.000Z");
    await ran(
      Phase.Completed,
      "2026-03-01T00:30:00.000Z",
      "2026-03-01T00:31:00.000Z",
    );
    await ran(
      Phase.Faulted,
      "2026-03-01T00:10:00.000Z",
      "2026-03-01T00:11:00.000Z",
      true,
    );
    const filter = {
      phases: [Phase.Faulted, Phase.Running, Phase.Waiting],
      from: at("2026-03-01T00:00:00.000Z"),
      to: at("2026-03-01T01:00:00.000Z"),
    };
    const request = pageOf(filter);

    const listed = await queries.list(request);

    const ids = listed.items.map((item) => item.id);
    expect(ids).toEqual([running, failed]);
    expect(listed.total).toBe(2);
  });

  it("test_runs_are_listed_with_their_mark_when_asked_for", async () => {
    const test = await ran(
      Phase.Completed,
      "2026-03-01T00:10:00.000Z",
      "2026-03-01T00:11:00.000Z",
      true,
    );
    const request = pageOf({ tests: true });

    const listed = await queries.list(request);

    expect(listed.items[0]?.id).toBe(test);
    expect(listed.items[0]?.test).toBe(true);
  });

  it("sorts_by_duration_longest_first_with_live_runs_by_their_elapsed_time", async () => {
    const minute = await ran(
      Phase.Completed,
      "2026-03-01T00:00:00.000Z",
      "2026-03-01T00:01:00.000Z",
    );
    const hour = await ran(
      Phase.Faulted,
      "2026-03-01T00:00:00.000Z",
      "2026-03-01T01:00:00.000Z",
    );
    const live = await ran(Phase.Running, "2026-02-01T00:00:00.000Z");
    const pending = await ran(Phase.Pending, null);
    const request = pageOf({}, { order: InstanceOrder.Duration });

    const listed = await queries.list(request);

    const ids = listed.items.map((item) => item.id);
    const durations = listed.items.map((item) => item.durationMs);
    expect(ids).toEqual([live, hour, minute, pending]);
    expect(durations.slice(1)).toEqual([3_600_000, 60_000, null]);
  });

  it("a_live_run_carries_its_elapsed_time_its_waits_and_its_starter", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at("2026-03-01T01:31:30.000Z"));
    const startedAt = at("2026-03-01T01:30:00.000Z");
    const until = Date.parse("2026-03-01T02:00:00.000Z");
    const id = await aRunRow(t.db, workflow, {
      phase: Phase.Waiting,
      startedAt,
      starterId: publisherId,
      runWaits: [
        {
          effectId: "/do/0/pause",
          kind: WaitKind.Timer,
          until,
          stream: null,
          retryOf: null,
          execution: null,
          position: null,
        },
      ],
    });
    const request = pageOf();

    const listed = await queries.list(request);

    const [item] = listed.items;
    expect(item?.id).toBe(id);
    expect(item?.startedBy).toEqual({ id: publisherId, name: "Ada" });
    expect(item?.waits).toEqual([
      { kind: WaitKind.Timer, until: new Date(until), stream: null },
    ]);
    expect(item?.durationMs).toBe(90_000);
  });
});

describe("PostgresInstanceQueries finding failing workflows", () => {
  let t: PersistenceTest;
  let queries: InstanceQueries;
  let routeLead: WorkflowRows;
  let digest: WorkflowRows;
  let healthy: WorkflowRows;

  const DAY = {
    from: at("2026-03-01T00:00:00.000Z"),
    to: at("2026-03-02T00:00:00.000Z"),
    limit: 5,
    tests: false,
  };

  const NOT_FOUND = {
    type: "https://serverlessworkflow.io/spec/1.0.0/errors/communication",
    status: 404,
    title: "Not found",
    detail: "GET https://example.com/status answered 404",
  };

  beforeAll(async () => {
    t = await createPersistenceTest(instanceQueries);
    queries = t.module.get(InstanceQueries);
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await truncateRuns(t.db);
    const publisherId = await aPublisher(t.db);
    routeLead = await aWorkflowRow(t.db, publisherId, { name: "route-lead" });
    digest = await aWorkflowRow(t.db, publisherId, { name: "digest" });
    healthy = await aWorkflowRow(t.db, publisherId, { name: "healthy" });
  });

  const ran = (
    workflow: WorkflowRows,
    phase: Phase,
    startedAt: string,
    error: JsonObject | null = null,
    test = false,
  ) => {
    const started = at(startedAt);
    return aRunRow(t.db, workflow, { phase, startedAt: started, error, test });
  };

  it("ranks_the_workflows_by_failed_runs_with_since_when_the_last_error_and_whether_they_still_fail", async () => {
    await ran(routeLead, Phase.Faulted, "2026-03-01T01:00:00.000Z", {
      title: "Old",
    });
    await ran(routeLead, Phase.Faulted, "2026-03-01T05:00:00.000Z", NOT_FOUND);
    await ran(routeLead, Phase.Running, "2026-03-01T06:00:00.000Z");
    await ran(routeLead, Phase.Completed, "2026-03-01T02:00:00.000Z");
    await ran(digest, Phase.Faulted, "2026-03-01T03:00:00.000Z");
    await ran(digest, Phase.Completed, "2026-03-01T04:00:00.000Z");
    await ran(healthy, Phase.Completed, "2026-03-01T04:00:00.000Z");
    await ran(healthy, Phase.Faulted, "2026-02-28T23:00:00.000Z");

    const failing = await queries.failing(DAY);

    expect(failing.workflows).toBe(2);
    expect(failing.failed).toBe(3);
    expect(failing.items).toEqual([
      {
        namespace: "sales",
        name: "route-lead",
        failed: 2,
        runs: 4,
        firstFailedAt: at("2026-03-01T01:00:00.000Z"),
        lastFailedAt: at("2026-03-01T05:00:00.000Z"),
        lastError: {
          status: 404,
          type: NOT_FOUND.type,
          title: "Not found",
          detail: NOT_FOUND.detail,
        },
        stillFailing: true,
      },
      {
        namespace: "sales",
        name: "digest",
        failed: 1,
        runs: 2,
        firstFailedAt: at("2026-03-01T03:00:00.000Z"),
        lastFailedAt: at("2026-03-01T03:00:00.000Z"),
        lastError: { status: null, type: null, title: null, detail: null },
        stillFailing: false,
      },
    ]);
  });

  it("the_limit_cuts_the_rows_but_not_the_totals_they_add_up_to", async () => {
    await ran(routeLead, Phase.Faulted, "2026-03-01T01:00:00.000Z");
    await ran(routeLead, Phase.Faulted, "2026-03-01T02:00:00.000Z");
    await ran(digest, Phase.Faulted, "2026-03-01T03:00:00.000Z");
    const top = { ...DAY, limit: 1 };

    const failing = await queries.failing(top);

    const names = failing.items.map((item) => item.name);
    expect(names).toEqual(["route-lead"]);
    expect(failing.workflows).toBe(2);
    expect(failing.failed).toBe(3);
  });

  it("test_runs_fail_no_workflow_unless_asked_for", async () => {
    await ran(routeLead, Phase.Faulted, "2026-03-01T01:00:00.000Z", null, true);
    const withTests = { ...DAY, tests: true };

    const without = await queries.failing(DAY);
    const including = await queries.failing(withTests);

    expect(without).toEqual({ items: [], workflows: 0, failed: 0 });
    expect(including.failed).toBe(1);
  });
});
