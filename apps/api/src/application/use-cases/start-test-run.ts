import { WorkflowAccessDeniedError } from '../../domain/errors.js';
import type { PinnedOutput, StepOutput } from '../../domain/interfaces.js';
import { Run } from '../../domain/run.js';
import type { Workflow } from '../../domain/workflow.js';
import type {
  ArtifactStore,
  Item,
  NodeSamples,
  RunRepository,
  StartTestRunCommand,
  WorkflowRepository,
} from '../interfaces.js';
import type { WorkflowPolicy } from '../policies/workflow.policy.js';
import type { ConfigurationCheck } from '../services/configuration-check.js';

export class StartTestRun {
  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly runs: RunRepository,
    private readonly artifacts: ArtifactStore,
    private readonly samples: NodeSamples,
    private readonly check: ConfigurationCheck,
    private readonly policy: WorkflowPolicy,
  ) {}

  async execute(command: StartTestRunCommand): Promise<Run> {
    const workflow = await this.workflows.getById(command.workflowId);
    const allowed = this.policy.manage(command.actor, workflow);

    if (!allowed) throw new WorkflowAccessDeniedError();

    const runId = Run.newId(null);
    const triggerPinned = workflow.pinnedNodeIds.includes(
      command.triggerNodeId,
    );
    const input =
      command.items.length === 0 && triggerPinned
        ? []
        : await this.inputOf(runId, command.triggerNodeId, command.items);
    const triggerHasInput = input.length > 0;
    const pins = await this.pinsOf(runId, workflow, triggerHasInput);
    const problems = this.check.problemsOf(workflow.graph);
    const run = workflow.startTestRun({
      runId,
      revision: command.revision,
      triggerNodeId: command.triggerNodeId,
      problems,
      input,
      pins,
    });
    await this.runs.add(run);
    return run;
  }

  private async inputOf(
    runId: string,
    nodeId: string,
    items: readonly Item[],
  ): Promise<StepOutput[]> {
    const triggerItems = items.length > 0 ? items : [{}];
    const output = await this.artifacts.write(
      { runId, nodeId, attempt: 0, port: 'main' },
      triggerItems,
    );
    return [output];
  }

  private async pinsOf(
    runId: string,
    workflow: Workflow,
    triggerHasInput: boolean,
  ): Promise<PinnedOutput[]> {
    const pins: PinnedOutput[] = [];

    for (const nodeId of workflow.pinnedNodeIds) {
      const node = workflow.graph.node(nodeId);

      if (node.isTrigger && triggerHasInput) continue;

      const items = await this.samples.pinned(workflow.id, nodeId);
      const output = await this.artifacts.write(
        { runId, nodeId, attempt: 0, port: 'main' },
        items,
      );
      pins.push({ nodeId, outputs: [output] });
    }

    return pins;
  }
}
