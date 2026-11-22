import type { CountWindow } from "../../../../../src/application/automation/instances/interfaces.js";
import { InstanceQueries } from "../../../../../src/application/automation/instances/queries.js";
import { Phase } from "../../../../../src/domain/automation/instances/enums.js";
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
