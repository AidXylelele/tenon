import { Injectable } from "@nestjs/common";
import { Schedule } from "../../../domain/automation/workflows/schedule.js";
import { WorkflowQueries } from "../workflows/queries.js";
import type {
  ExpectedStarts,
  ListExpectedStartsCommand,
} from "./interfaces.js";

@Injectable()
export class ListExpectedStarts {
  private static readonly GRACE = 60 * 1_000;
  private static readonly WEEK = 7 * 24 * 60 * 60 * 1_000;
  private static readonly NEXT = 10;

  constructor(private readonly workflows: WorkflowQueries) {}

  async execute(command: ListExpectedStartsCommand): Promise<ExpectedStarts[]> {
    const now = Date.now();
    const due = now - ListExpectedStarts.GRACE;
    const horizon = now + ListExpectedStarts.WEEK;
    const windowStart = command.from.getTime();
    const scheduled = await this.workflows.scheduled();
    const plans = scheduled.map((workflow) => {
      const schedule = new Schedule(workflow.schedule);
      const since = Math.max(windowStart, workflow.since.getTime());
      const passed = schedule.passedSlots(since, due);
      const next = schedule.upcoming(now, horizon, ListExpectedStarts.NEXT);
      return { workflowId: workflow.workflowId, passed, next };
    });
    const slots = plans.map((plan) => ({
      workflowId: plan.workflowId,
      from: new Date(plan.passed.from),
      to: new Date(plan.passed.to),
    }));
    const started = await this.workflows.scheduledStarts(slots);
    return started.map((workflow) => {
      const plan = plans.find(
        (each) => each.workflowId === workflow.workflowId,
      );

      if (plan === undefined)
        throw new TypeError(`No schedule plans ${workflow.workflowId}`);

      const unstarted = plan.passed.count - workflow.starts;
      const missed = Math.max(0, unstarted);
      const next = plan.next.map((at) => new Date(at));
      const missedSince = new Date(plan.passed.from);
      return {
        namespace: workflow.namespace,
        name: workflow.name,
        title: workflow.title,
        lastRun: workflow.lastRun,
        schedule: workflow.schedule,
        next,
        missed,
        missedSince,
      };
    });
  }
}
