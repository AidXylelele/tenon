import { Injectable } from '@nestjs/common';
import { WorkflowClient } from '@nestjs/workflows';
import type { ActiveSchedule } from '../../application/interfaces.js';
import { ListActiveSchedules } from '../../application/use-cases/list-active-schedules.js';
import { WorkflowNotFoundError } from '../../domain/errors.js';
import { ScheduledTriggerWorkflow } from './scheduled-trigger.workflow.js';

@Injectable()
export class ScheduleRegistrar {
  static readonly WORKFLOW = 'automation.scheduled-trigger';
  static readonly PAGE = 100;

  constructor(
    private readonly client: WorkflowClient,
    private readonly listActiveSchedules: ListActiveSchedules,
  ) {}

  async sync(workflowId: string): Promise<void> {
    const wanted = await this.wanted(workflowId);
    const ids = new Set<string>();

    for (const schedule of wanted) {
      const id = ScheduleRegistrar.idOf(schedule);
      const timing = ScheduleRegistrar.timingOf(schedule);
      ids.add(id);
      await this.client.schedules.upsert(id, {
        workflow: ScheduledTriggerWorkflow,
        ...timing,
        tz: schedule.timezone,
        missed: 'skip',
        overlap: 'skip',
        input: {
          workflowId,
          releaseNumber: schedule.releaseNumber,
          nodeId: schedule.nodeId,
        },
      });
    }

    const registered = await this.registered();

    for (const id of registered.get(workflowId) ?? []) {
      const kept = ids.has(id);

      if (!kept) await this.client.schedules.remove(id);
    }
  }

  async registered(): Promise<Map<string, string[]>> {
    const byWorkflow = new Map<string, string[]>();

    for (let offset = 0; ; offset += ScheduleRegistrar.PAGE) {
      const page = await this.client.schedules.list({
        workflow: ScheduleRegistrar.WORKFLOW,
        limit: ScheduleRegistrar.PAGE,
        offset,
      });

      for (const schedule of page) {
        const [, workflowId] = schedule.id.split('.');

        if (!workflowId) continue;

        const ids = byWorkflow.get(workflowId) ?? [];
        ids.push(schedule.id);
        byWorkflow.set(workflowId, ids);
      }

      if (page.length < ScheduleRegistrar.PAGE) return byWorkflow;
    }
  }

  private async wanted(workflowId: string): Promise<ActiveSchedule[]> {
    try {
      return await this.listActiveSchedules.execute(workflowId);
    } catch (error) {
      if (error instanceof WorkflowNotFoundError) return [];

      throw error;
    }
  }

  private static idOf(schedule: ActiveSchedule): string {
    return `wf.${schedule.workflowId}.${schedule.nodeId}.${schedule.rule}`;
  }

  private static timingOf(
    schedule: ActiveSchedule,
  ): { cron: string } | { rrule: string } {
    if (schedule.kind === 'cron') return { cron: schedule.expression };

    return { rrule: schedule.expression };
  }
}
