import {
  FailingWorkflowsQuery,
  InstanceCountsQuery,
  ListInstancesQuery,
} from "../../../../../src/interface-adapters/api/schemas/instance.schema.js";

const DAY = 24 * 60 * 60 * 1_000;
const to = new Date("2026-11-23T00:00:00.000Z");

function before(days: number): string {
  const at = to.getTime() - days * DAY;
  return new Date(at).toISOString();
}

describe("the bounds of the run reads", () => {
  it("a_page_starting_within_the_counted_runs_is_read", () => {
    const query = { page: "200", limit: "50" };

    const parsed = ListInstancesQuery.safeParse(query);

    expect(parsed.success).toBe(true);
  });

  it("a_page_starting_beyond_the_counted_runs_is_refused", () => {
    const query = { page: "201", limit: "50" };

    const parsed = ListInstancesQuery.safeParse(query);

    expect(parsed.success).toBe(false);
  });

  it("counts_of_thirty_days_with_the_previous_thirty_are_read", () => {
    const query = {
      bucket: [before(30), before(15)],
      to: to.toISOString(),
      previousFrom: before(60),
    };

    const parsed = InstanceCountsQuery.safeParse(query);

    expect(parsed.success).toBe(true);
  });

  it("counts_spanning_more_than_the_longest_window_are_refused", () => {
    const query = {
      bucket: before(60),
      to: to.toISOString(),
      previousFrom: before(400),
    };

    const parsed = InstanceCountsQuery.safeParse(query);

    expect(parsed.success).toBe(false);
  });

  it("failing_workflows_of_a_window_longer_than_the_longest_are_refused", () => {
    const within = { from: before(30), to: to.toISOString() };
    const beyond = { from: before(400), to: to.toISOString() };

    const read = FailingWorkflowsQuery.safeParse(within);
    const refused = FailingWorkflowsQuery.safeParse(beyond);

    expect(read.success).toBe(true);
    expect(refused.success).toBe(false);
  });
});
