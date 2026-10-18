import { WorkflowAccessDeniedError } from '../../domain/errors.js';
import type { Release } from '../../domain/release.js';
import type {
  PublishReleaseCommand,
  ReleaseRepository,
  WorkflowRepository,
} from '../interfaces.js';
import type { WorkflowPolicy } from '../policies/workflow.policy.js';
import type { ConfigurationCheck } from '../services/configuration-check.js';

export class PublishRelease {
  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly releases: ReleaseRepository,
    private readonly check: ConfigurationCheck,
    private readonly policy: WorkflowPolicy,
  ) {}

  async execute(command: PublishReleaseCommand): Promise<Release> {
    const workflow = await this.workflows.getById(command.workflowId);
    const allowed = this.policy.manage(command.actor, workflow);

    if (!allowed) throw new WorkflowAccessDeniedError();

    const problems = this.check.problemsOf(workflow.graph);
    const release = workflow.publish(
      command.revision,
      problems,
      command.actor.id,
    );
    await this.releases.add(release);
    await this.workflows.update(workflow);
    return release;
  }
}
