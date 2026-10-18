import { TriggerType } from '../../domain/enums.js';
import { Run } from '../../domain/run.js';
import type {
  ArtifactStore,
  ReleaseRepository,
  RunRepository,
  StartWebhookRunCommand,
  WorkflowRepository,
} from '../interfaces.js';

export class StartWebhookRun {
  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly releases: ReleaseRepository,
    private readonly runs: RunRepository,
    private readonly artifacts: ArtifactStore,
  ) {}

  async execute(command: StartWebhookRunCommand): Promise<Run> {
    const key =
      command.deliveryId === null
        ? null
        : `webhook:${command.endpointId}:${command.deliveryId}`;
    const runId = Run.newId(key);
    const existing = await this.runs.findById(runId);

    if (existing) return existing;

    const workflow = await this.workflows.getById(command.workflowId);
    const release = await this.releases.get(
      command.workflowId,
      command.releaseNumber,
    );
    const input = await this.artifacts.write(
      { runId, nodeId: command.nodeId, attempt: 0, port: 'main' },
      [
        {
          method: command.request.method,
          headers: command.request.headers,
          query: command.request.query,
          body: command.request.body,
        },
      ],
    );
    const run = workflow.startTriggeredRun(release, {
      runId,
      trigger: { type: TriggerType.Webhook, nodeId: command.nodeId, key },
      input: [input],
    });
    await this.runs.add(run);
    return run;
  }
}
