import type {
  WorkflowSchedule,
  WorkflowSchedulePreviewSpec,
  WorkflowSchedules,
} from "@nestjs/workflows";
import type { ScheduledStarts } from "../../../../../src/application/automation/schedules/interfaces.js";
import type { WorkflowQueries } from "../../../../../src/application/automation/workflows/queries.js";
import { EngineExpectedStartsQueries } from "../../../../../src/interface-adapters/workflows/queries/engine-expected-starts.queries.js";

class SilentSchedule {
  readonly previews: number[] = [];

  list(): Promise<WorkflowSchedule[]> {
    const schedule = {
      id: "schedule-w-1",
      cron: "0 9 * * *",
      tz: "UTC",
      createdAt: Date.UTC(2026, 0, 1),
    } as unknown as WorkflowSchedule;
    return Promise.resolve([schedule]);
  }

  preview(
    _spec: WorkflowSchedulePreviewSpec,
    options: { readonly from: number },
  ): Promise<number[]> {
    this.previews.push(options.from);
    return Promise.resolve([]);
  }
}

class Starts {
  scheduledStarts(): Promise<ScheduledStarts[]> {
    const starts = {
      workflowId: "w-1",
      namespace: "sales",
      name: "daily",
      title: null,
      lastRun: null,
      schedule: null,
      starts: 0,
    };
    return Promise.resolve([starts]);
  }
}

describe("the starts a schedule was expected to make", () => {
  it("a_schedule_with_no_passed_start_previews_only_its_passed_and_next_starts", async () => {
    const engine = new SilentSchedule();
    const queries = new EngineExpectedStartsQueries(
      engine as unknown as WorkflowSchedules,
      new Starts() as unknown as WorkflowQueries,
    );
    const from = new Date(Date.UTC(2026, 0, 2));

    const [expected] = await queries.expected(from);

    expect(engine.previews).toHaveLength(2);
    expect(expected?.missed).toBe(0);
  });
});
