import type {
  ScheduledStarts,
  ScheduledWorkflow,
  StartSlot,
} from "../../../../../src/application/automation/schedules/interfaces.js";
import { ListExpectedStarts } from "../../../../../src/application/automation/schedules/list-expected-starts.js";
import type { WorkflowQueries } from "../../../../../src/application/automation/workflows/queries.js";
import { ScheduleKind } from "../../../../../src/domain/automation/workflows/enums.js";

class Starts {
  readonly slots: StartSlot[] = [];

  constructor(private readonly starts: number) {}

  scheduled(): Promise<ScheduledWorkflow[]> {
    const daily = {
      workflowId: "w-1",
      schedule: { kind: ScheduleKind.Cron, cron: "0 9 * * *" },
      since: new Date(Date.UTC(2026, 0, 1)),
    } as const;
    return Promise.resolve([daily]);
  }

  scheduledStarts(slots: readonly StartSlot[]): Promise<ScheduledStarts[]> {
    for (const slot of slots) this.slots.push(slot);

    const starts = {
      workflowId: "w-1",
      namespace: "sales",
      name: "daily",
      title: null,
      lastRun: null,
      schedule: null,
      starts: this.starts,
    };
    return Promise.resolve([starts]);
  }
}

function listOf(starts: Starts): ListExpectedStarts {
  return new ListExpectedStarts(starts as unknown as WorkflowQueries);
}

describe("the starts a schedule was expected to make", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("a_schedule_with_no_passed_start_misses_nothing_and_shows_its_next", async () => {
    vi.setSystemTime(Date.UTC(2026, 0, 2, 8));
    const starts = new Starts(0);
    const from = new Date(Date.UTC(2026, 0, 2));

    const [expected] = await listOf(starts).execute({ from });

    expect(expected?.missed).toBe(0);
    expect(expected?.next[0]).toEqual(new Date(Date.UTC(2026, 0, 2, 9)));
    expect(expected?.next).toHaveLength(7);
  });

  it("counts_the_passed_slots_its_instances_did_not_start", async () => {
    vi.setSystemTime(Date.UTC(2026, 0, 4, 12));
    const starts = new Starts(1);
    const from = new Date(Date.UTC(2026, 0, 1));

    const [expected] = await listOf(starts).execute({ from });

    expect(starts.slots).toEqual([
      {
        workflowId: "w-1",
        from: new Date(Date.UTC(2026, 0, 1, 9)),
        to: new Date(Date.UTC(2026, 0, 5, 9)),
      },
    ]);
    expect(expected?.missed).toBe(3);
    expect(expected?.missedSince).toEqual(new Date(Date.UTC(2026, 0, 1, 9)));
  });
});
