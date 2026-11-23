import { Injectable } from "@nestjs/common";
import type {
  ExpectedStarts,
  ScheduledStarts,
  ScheduledWorkflow,
} from "../../../application/automation/schedules/interfaces.js";
import type { ScheduleQueries } from "../../../application/automation/schedules/queries.js";
import { WorkflowQueries } from "../../../application/automation/workflows/queries.js";
import { Schedule } from "../../../domain/automation/workflows/schedule.js";
import type { SchedulePlan } from "../interfaces.js";

@Injectable()
export class ExpectedStartsQueries implements ScheduleQueries {
  private static readonly PREVIEW = 1_000;
  private static readonly NEXT = 10;
  private static readonly WEEK = 7 * 24 * 60 * 60 * 1_000;
  private static readonly GRACE = 60 * 1_000;

  constructor(private readonly workflows: WorkflowQueries) {}

  async expected(from: Date): Promise<ExpectedStarts[]> {
    const now = Date.now();
    const scheduled = await this.workflows.scheduled();
    const plans = scheduled.map((workflow) =>
      this.#planOf(workflow, from, now),
    );
    const slots = plans.map((plan) => plan.slot);
    const started = await this.workflows.scheduledStarts(slots);
    return started.map((workflow) => this.#expectedOf(workflow, plans));
  }

  #planOf(workflow: ScheduledWorkflow, from: Date, now: number): SchedulePlan {
    const schedule = new Schedule(workflow.schedule);
    const due = now - ExpectedStartsQueries.GRACE;
    const windowStart = from.getTime();
    const since = Math.max(windowStart, workflow.since.getTime());
    const passed = this.#passedOf(schedule, since, due);
    const start = passed[0] ?? since;
    const end = this.#endOf(schedule, passed, start, now);
    const slot = {
      workflowId: workflow.workflowId,
      from: new Date(start),
      to: new Date(end),
    };
    const next = this.#nextOf(schedule, now);
    return { slot, expected: passed.length, next };
  }

  #endOf(
    schedule: Schedule,
    passed: readonly number[],
    start: number,
    now: number,
  ): number {
    const last = passed.at(-1);

    if (last === undefined) return start;

    const following = schedule.occurrencesAfter(last, 1);
    return following[0] ?? now;
  }

  #passedOf(schedule: Schedule, since: number, due: number): number[] {
    const most = ExpectedStartsQueries.PREVIEW;
    const earliest = schedule.occurrencesAfter(since, most);
    const first = earliest[0];
    const last = earliest.at(-1);

    if (first === undefined || last === undefined) return [];

    const reached = last >= due;
    const ended = earliest.length < most;

    if (reached || ended) return earliest.filter((at) => at <= due);

    const span = last - first;
    const before = due - span - 1;
    const latest = schedule.occurrencesAfter(before, most);
    return latest.filter((at) => at <= due);
  }

  #nextOf(schedule: Schedule, now: number): Date[] {
    const horizon = now + ExpectedStartsQueries.WEEK;
    const upcoming = schedule.occurrencesAfter(now, ExpectedStartsQueries.NEXT);
    const within = upcoming.filter((at) => at <= horizon);
    return within.map((at) => new Date(at));
  }

  #expectedOf(
    workflow: ScheduledStarts,
    plans: readonly SchedulePlan[],
  ): ExpectedStarts {
    const plan = plans.find(
      (each) => each.slot.workflowId === workflow.workflowId,
    );

    if (plan === undefined)
      throw new TypeError(`No schedule plans ${workflow.workflowId}`);

    const unstarted = plan.expected - workflow.starts;
    const missed = Math.max(0, unstarted);
    return {
      namespace: workflow.namespace,
      name: workflow.name,
      title: workflow.title,
      lastRun: workflow.lastRun,
      schedule: workflow.schedule,
      next: plan.next,
      missed,
      missedSince: plan.slot.from,
    };
  }
}
