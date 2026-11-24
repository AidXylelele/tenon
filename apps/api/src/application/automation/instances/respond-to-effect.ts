import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import { RunSecrets } from "../../../domain/automation/secrets/run-secrets.js";
import { SecretRepository } from "../secrets/ports.js";
import type { RespondCommand } from "./interfaces.js";
import { InstanceEvents } from "./instance-events.js";
import { WorkflowInstanceRepository, WorkflowRuntime } from "./ports.js";

@Injectable()
export class RespondToEffect {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly runtime: WorkflowRuntime,
    private readonly secrets: SecretRepository,
    private readonly events: InstanceEvents,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: RespondCommand): Promise<void> {
    const instance = await this.instances.find(command.instanceId);

    if (instance === null) return;

    const awaited = instance.awaits(command.answer.effectId);

    if (!awaited) return;

    const declared = await this.secrets.findDeclared(instance.versionId);
    const secrets = RunSecrets.of(declared);
    const now = new Date();
    const turn = await this.runtime.respond(
      instance,
      command.answer,
      secrets,
      now,
      command.signal,
    );
    instance.advance(turn, secrets, now);
    await this.unitOfWork.run(async () => {
      await this.instances.save(instance);
      await this.events.dispatch(instance);
    });
  }
}
