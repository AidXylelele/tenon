import { WorkflowAccessDeniedError } from '../../domain/errors.js';
import { Run } from '../../domain/run.js';
import type {
  ArtifactStore,
  ReleaseRepository,
  RunRepository,
  StartManualRunCommand,
  WorkflowRepository,
} from '../interfaces.js';
import type { WorkflowPolicy } from '../policies/workflow.policy.js';

export class StartManualRun {
  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly releases: ReleaseRepository,
    private readonly runs: RunRepository,
    private readonly artifacts: ArtifactStore,
    private readonly policy: WorkflowPolicy,
  ) {}

  async execute(command: StartManualRunCommand): Promise<Run> {
    const workflow = await this.workflows.getById(command.workflowId);
    const allowed = this.policy.manage(command.actor, workflow);

    if (!allowed) throw new WorkflowAccessDeniedError();

    const release = await this.releases.get(workflow.id, command.releaseNumber);
    const runId = Run.newId(null);
    const triggerItems = command.items.length > 0 ? command.items : [{}];
    const input = await this.artifacts.write(
      { runId, nodeId: command.triggerNodeId, attempt: 0, port: 'main' },
      triggerItems,
    );
    const run = workflow.startManualRun(release, {
      runId,
      triggerNodeId: command.triggerNodeId,
      input: [input],
    });
    await this.runs.add(run);
    return run;
  }
}
