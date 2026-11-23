import { Injectable } from "@nestjs/common";
import {
  type WorkflowSchedule,
  type WorkflowSchedulePreviewSpec,
  WorkflowSchedules as EngineSchedules,
} from "@nestjs/workflows";
import type {
  ExpectedStarts,
  ScheduledStarts,
} from "../../../application/automation/schedules/interfaces.js";
import type { ScheduleQueries } from "../../../application/automation/schedules/queries.js";
import { WorkflowQueries } from "../../../application/automation/workflows/queries.js";
import { EngineScheduleGateway } from "../gateways/engine-schedule.gateway.js";
import type { SchedulePlan } from "../interfaces.js";

@Injectable()
export class EngineExpectedStartsQueries implements ScheduleQueries {
  private static readonly MOST_SCHEDULES = 10_000;
  private static readonly PREVIEW = 1_000;
  private static readonly NEXT = 10;
  private static readonly WEEK = 7 * 24 * 60 * 60 * 1_000;
  private static readonly GRACE = 60 * 1_000;

  constructor(
    private readonly schedules: EngineSchedules,
    private readonly workflows: WorkflowQueries,
  ) {}

  async expected(from: Date): Promise<ExpectedStarts[]> {
    const now = Date.now();
    const listed = await this.schedules.list({
      limit: EngineExpectedStartsQueries.MOST_SCHEDULES,
    });
    const ours = listed.filter((schedule) =>
      schedule.id.startsWith(EngineScheduleGateway.PREFIX),
    );
    const plans = await Promise.all(
      ours.map((schedule) => this.#planOf(schedule, from, now)),
    );
    const slots = plans.map((plan) => plan.slot);
    const started = await this.workflows.scheduledStarts(slots);
    return started.map((workflow) => this.#expectedOf(workflow, plans));
  }

  async #planOf(
    schedule: WorkflowSchedule,
    from: Date,
    now: number,
  ): Promise<SchedulePlan> {
    const spec = this.#specOf(schedule);
    const workflowId = schedule.id.slice(EngineScheduleGateway.PREFIX.length);
    const due = now - EngineExpectedStartsQueries.GRACE;
    const windowStart = from.getTime();
    const since = Math.max(windowStart, schedule.createdAt);
    const passed = await this.#passedOf(spec, since, due);
    const start = passed[0] ?? since;
    const end = await this.#endOf(spec, passed, start, now);
    const slot = { workflowId, from: new Date(start), to: new Date(end) };
    const next = await this.#nextOf(spec, now);
    return { slot, expected: passed.length, next };
  }

  async #endOf(
    spec: WorkflowSchedulePreviewSpec,
    passed: readonly number[],
    start: number,
    now: number,
  ): Promise<number> {
    const last = passed.at(-1);

    if (last === undefined) return start;

    const [following] = await this.#preview(spec, last, 1);
    return following ?? now;
  }

  async #passedOf(
    spec: WorkflowSchedulePreviewSpec,
    since: number,
    due: number,
  ): Promise<number[]> {
    const most = EngineExpectedStartsQueries.PREVIEW;
    const earliest = await this.#preview(spec, since, most);
    const first = earliest[0];
    const last = earliest.at(-1);

    if (first === undefined || last === undefined) return [];

    const reached = last >= due;
    const ended = earliest.length < most;

    if (reached || ended) return earliest.filter((at) => at <= due);

    const span = last - first;
    const before = due - span - 1;
    const latest = await this.#preview(spec, before, most);
    return latest.filter((at) => at <= due);
  }

  async #nextOf(
    spec: WorkflowSchedulePreviewSpec,
    now: number,
  ): Promise<Date[]> {
    const horizon = now + EngineExpectedStartsQueries.WEEK;
    const upcoming = await this.#preview(
      spec,
      now,
      EngineExpectedStartsQueries.NEXT,
    );
    const within = upcoming.filter((at) => at <= horizon);
    return within.map((at) => new Date(at));
  }

  #preview(
    spec: WorkflowSchedulePreviewSpec,
    after: number,
    count: number,
  ): Promise<number[]> {
    return this.schedules.preview(spec, { from: after, count });
  }

  #specOf(schedule: WorkflowSchedule): WorkflowSchedulePreviewSpec {
    const zoned = schedule.every === undefined;
    const tz = zoned ? schedule.tz : undefined;
    return {
      cron: schedule.cron,
      every: schedule.every,
      rrule: schedule.rrule,
      tz,
      startAt: schedule.startAt ?? undefined,
      endAt: schedule.endAt ?? undefined,
      limit: schedule.limit ?? undefined,
    };
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
