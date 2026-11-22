import { Injectable } from "@nestjs/common";
import {
  Propagation,
  Transactional,
  TransactionHost,
} from "@nestjs-cls/transactional";
import {
  WorkflowClient,
  type WorkflowSchedule,
  type WorkflowSchedulePreviewSpec,
  WorkflowSchedules as EngineSchedules,
} from "@nestjs/workflows";
import type {
  ExpectedStarts,
  ScheduledStarts,
} from "../../../application/automation/schedules/interfaces.js";
import type { WorkflowSchedules } from "../../../application/automation/schedules/ports.js";
import type { ScheduleQueries } from "../../../application/automation/schedules/queries.js";
import { WorkflowQueries } from "../../../application/automation/workflows/queries.js";
import type { DefinitionProblem } from "../../../application/automation/workflows/interfaces.js";
import type { WorkflowInstance } from "../../../domain/automation/instances/workflow-instance.js";
import type { CheckedDefinition } from "../../../domain/automation/workflows/checked-definition.js";
import { ScheduleKind } from "../../../domain/automation/workflows/enums.js";
import type { Workflow } from "../../../domain/automation/workflows/workflow.js";
import type { WorkflowVersion } from "../../../domain/automation/workflows/workflow-version.js";
import type { Transaction } from "../../persistence/interfaces.js";
import type { ScheduleRunInput } from "../runners/interfaces.js";
import type { SchedulePlan } from "../interfaces.js";
import { ScheduleRun } from "../runners/schedule.run.js";

@Injectable()
export class EngineScheduleGateway
  implements WorkflowSchedules, ScheduleQueries
{
  private static readonly UTC = "UTC";
  private static readonly CRON_POINTER = "/schedule/cron";
  private static readonly PREFIX = "schedule-";
  private static readonly MOST_SCHEDULES = 10_000;
  private static readonly PREVIEW = 1_000;
  private static readonly NEXT = 10;
  private static readonly WEEK = 7 * 24 * 60 * 60 * 1_000;
  private static readonly GRACE = 60 * 1_000;

  constructor(
    private readonly schedules: EngineSchedules,
    private readonly client: WorkflowClient,
    private readonly txHost: TransactionHost<Transaction>,
    private readonly workflows: WorkflowQueries,
  ) {}

  async expected(from: Date): Promise<ExpectedStarts[]> {
    const now = Date.now();
    const listed = await this.schedules.list({
      limit: EngineScheduleGateway.MOST_SCHEDULES,
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
    const due = now - EngineScheduleGateway.GRACE;
    const since = Math.max(from.getTime(), schedule.createdAt);
    const passed = await this.#passedOf(spec, since, due);
    const last = passed.at(-1) ?? due;
    const [following] = await this.#preview(spec, last, 1);
    const start = passed[0] ?? since;
    const end = passed.length === 0 ? start : (following ?? now);
    const slot = { workflowId, from: new Date(start), to: new Date(end) };
    const next = await this.#nextOf(spec, now);
    return { slot, expected: passed.length, next };
  }

  async #passedOf(
    spec: WorkflowSchedulePreviewSpec,
    since: number,
    due: number,
  ): Promise<number[]> {
    const most = EngineScheduleGateway.PREVIEW;
    const earliest = await this.#preview(spec, since, most);
    const first = earliest[0];
    const last = earliest.at(-1);

    if (first === undefined || last === undefined) return [];

    const reached = last >= due;
    const ended = earliest.length < most;

    if (reached || ended) return earliest.filter((at) => at <= due);

    const span = last - first;
    const latest = await this.#preview(spec, due - span - 1, most);
    return latest.filter((at) => at <= due);
  }

  async #nextOf(
    spec: WorkflowSchedulePreviewSpec,
    now: number,
  ): Promise<Date[]> {
    const horizon = now + EngineScheduleGateway.WEEK;
    const upcoming = await this.#preview(spec, now, EngineScheduleGateway.NEXT);
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
      schedule: workflow.schedule,
      next: plan.next,
      missed,
      missedSince: plan.slot.from,
    };
  }

  async check(
    definition: CheckedDefinition,
  ): Promise<DefinitionProblem | null> {
    const schedule = definition.schedule;

    if (schedule?.kind !== ScheduleKind.Cron) return null;

    try {
      await this.schedules.preview(
        { cron: schedule.cron, tz: EngineScheduleGateway.UTC },
        { count: 1 },
      );
      return null;
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;

      return {
        code: "cron",
        pointer: EngineScheduleGateway.CRON_POINTER,
        detail: error.message,
        line: null,
        column: null,
      };
    }
  }

  async apply(workflow: Workflow, version: WorkflowVersion): Promise<void> {
    const id = this.#idOf(workflow.id);
    const input: ScheduleRunInput = {
      workflowId: workflow.id,
      delayMs: 0,
      chained: false,
    };
    const schedule = version.schedule;

    if (schedule?.kind === ScheduleKind.Cron) {
      await this.schedules.upsert(id, {
        workflow: ScheduleRun,
        missed: "once",
        overlap: "allow",
        input,
        cron: schedule.cron,
        tz: EngineScheduleGateway.UTC,
      });
      return;
    }

    if (schedule?.kind === ScheduleKind.Every) {
      await this.schedules.upsert(id, {
        workflow: ScheduleRun,
        missed: "once",
        overlap: "allow",
        input,
        every: schedule.interval,
      });
      return;
    }

    await this.schedules.remove(id);

    if (schedule?.kind !== ScheduleKind.After) return;

    const first: ScheduleRunInput = {
      workflowId: workflow.id,
      delayMs: 0,
      chained: true,
    };
    const firstId = `after-${workflow.id}-${String(workflow.version)}`;
    await this.client.start(ScheduleRun, first, { id: firstId });
  }

  async clear(workflow: Workflow): Promise<void> {
    const id = this.#idOf(workflow.id);
    await this.schedules.remove(id);
  }

  @Transactional(Propagation.Mandatory)
  async continueAfter(
    instance: WorkflowInstance,
    version: WorkflowVersion,
  ): Promise<void> {
    const schedule = version.schedule;

    if (schedule?.kind !== ScheduleKind.After) return;

    const next: ScheduleRunInput = {
      workflowId: instance.workflowId,
      delayMs: schedule.delay,
      chained: true,
    };
    await this.client.start(ScheduleRun, next, {
      id: `after-${instance.id}`,
      transaction: this.txHost.tx,
    });
  }

  #idOf(workflowId: string): string {
    return `schedule-${workflowId}`;
  }
}
