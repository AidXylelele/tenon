import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import { RunSecrets } from "../../../domain/automation/secrets/run-secrets.js";
import { SecretRepository } from "../secrets/ports.js";
import type { RunCommand } from "./interfaces.js";
import {
  InstanceEvents,
  WorkflowInstanceRepository,
  WorkflowRuntime,
} from "./ports.js";

@Injectable()
export class BeginRun {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly runtime: WorkflowRuntime,
    private readonly secrets: SecretRepository,
    private readonly events: InstanceEvents,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: RunCommand): Promise<void> {
    const instance = await this.instances.find(command.instanceId);

    if (!instance?.pending) return;

    const declared = await this.secrets.findDeclared(instance.versionId);
    const secrets = RunSecrets.of(declared);
    const now = new Date();
    const turn = await this.runtime.begin(
      instance,
      secrets,
      now,
      command.signal,
    );
    instance.begin(turn, secrets, now);
    await this.unitOfWork.run(async () => {
      await this.instances.save(instance);
      await this.events.dispatch(instance);
    });
  }
}
