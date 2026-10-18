import { WorkflowAccessDeniedError } from '../../domain/errors.js';
import type { Workflow } from '../../domain/workflow.js';
import type {
  ActivateReleaseCommand,
  ReleaseRepository,
  WorkflowRepository,
} from '../interfaces.js';
import type { WorkflowPolicy } from '../policies/workflow.policy.js';
import type { ConfigurationCheck } from '../services/configuration-check.js';

export class ActivateRelease {
  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly releases: ReleaseRepository,
    private readonly check: ConfigurationCheck,
    private readonly policy: WorkflowPolicy,
  ) {}

  async execute(command: ActivateReleaseCommand): Promise<Workflow> {
    const workflow = await this.workflows.getById(command.workflowId);
    const allowed = this.policy.manage(command.actor, workflow);

    if (!allowed) throw new WorkflowAccessDeniedError();

    const release = await this.releases.get(
      command.workflowId,
      command.releaseNumber,
    );
    const problems = this.check.problemsOf(release.graph);
    workflow.activate(release, problems);
    await this.workflows.update(workflow);
    return workflow;
  }
}
