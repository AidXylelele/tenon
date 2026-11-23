import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import { RunSecrets } from "../../../domain/automation/secrets/run-secrets.js";
import { TriggerKind } from "../../../domain/automation/instances/enums.js";
import { EventStore } from "../events/ports.js";
import {
  InstanceRuns,
  WorkflowInstanceRepository,
  WorkflowRuntime,
} from "../instances/ports.js";
import { SecretRepository } from "../secrets/ports.js";
import { WorkflowRepository } from "../workflows/ports.js";
import type { TriggerCommand } from "./interfaces.js";

@Injectable()
export class StartOnEvent {
  constructor(
    private readonly events: EventStore,
    private readonly workflows: WorkflowRepository,
    private readonly instances: WorkflowInstanceRepository,
    private readonly runtime: WorkflowRuntime,
    private readonly secrets: SecretRepository,
    private readonly runs: InstanceRuns,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: TriggerCommand): Promise<void> {
    const event = await this.events.find(command.sequence);
    const workflow = await this.workflows.findById(command.workflowId);
    const version = workflow?.scheduledVersion ?? null;

    if (event === null || workflow === null || version === null) return;

    const declared = await this.secrets.findDeclared(version.id);
    const secrets = RunSecrets.of(declared);
    const now = new Date();
    const accepted = await this.runtime.accepts(
      version,
      event,
      secrets,
      now,
      command.signal,
    );

    if (!accepted) return;

    const consumed = [event.cloudEvent];
    const started = workflow.startScheduledInstance({
      instanceId: null,
      version,
      input: consumed,
      trigger: TriggerKind.Event,
      chained: false,
      chainRunning: false,
      lifecycleOf: event.lifecycleOf,
      now,
    });

    if (!started.ok) return;

    const instance = started.value;
    await this.unitOfWork.run(async () => {
      await this.instances.save(instance);
      await this.runs.start(instance);
    });
  }
}
