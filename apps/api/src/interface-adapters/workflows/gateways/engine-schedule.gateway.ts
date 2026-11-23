import { Injectable } from "@nestjs/common";
import {
  Propagation,
  Transactional,
  TransactionHost,
} from "@nestjs-cls/transactional";
import {
  WorkflowClient,
  WorkflowSchedules as EngineSchedules,
} from "@nestjs/workflows";
import type { WorkflowSchedules } from "../../../application/automation/schedules/ports.js";
import type { DefinitionProblem } from "../../../application/automation/workflows/interfaces.js";
import type { WorkflowInstance } from "../../../domain/automation/instances/workflow-instance.js";
import type { CheckedDefinition } from "../../../domain/automation/workflows/checked-definition.js";
import { ScheduleKind } from "../../../domain/automation/workflows/enums.js";
import type { Workflow } from "../../../domain/automation/workflows/workflow.js";
import type { WorkflowVersion } from "../../../domain/automation/workflows/workflow-version.js";
import type { Transaction } from "../../persistence/interfaces.js";
import type { ScheduleRunInput } from "../runners/interfaces.js";
import { ScheduleRun } from "../runners/schedule.run.js";

@Injectable()
export class EngineScheduleGateway implements WorkflowSchedules {
  static readonly PREFIX = "schedule-";
  private static readonly UTC = "UTC";
  private static readonly CRON_POINTER = "/schedule/cron";

  constructor(
    private readonly schedules: EngineSchedules,
    private readonly client: WorkflowClient,
    private readonly txHost: TransactionHost<Transaction>,
  ) {}

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
    return `${EngineScheduleGateway.PREFIX}${workflowId}`;
  }
}
