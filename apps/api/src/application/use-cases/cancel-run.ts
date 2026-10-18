import { WorkflowAccessDeniedError } from '../../domain/errors.js';
import type { Run } from '../../domain/run.js';
import type {
  CancelRunCommand,
  RunRepository,
  WorkflowRepository,
} from '../interfaces.js';
import type { WorkflowPolicy } from '../policies/workflow.policy.js';

export class CancelRun {
  constructor(
    private readonly runs: RunRepository,
    private readonly workflows: WorkflowRepository,
    private readonly policy: WorkflowPolicy,
  ) {}

  async execute(command: CancelRunCommand): Promise<Run> {
    const run = await this.runs.getById(command.runId);
    const workflow = await this.workflows.getById(run.workflowId);
    const allowed = this.policy.manage(command.actor, workflow);

    if (!allowed) throw new WorkflowAccessDeniedError();

    run.cancel();
    await this.runs.update(run);
    return run;
  }
}
