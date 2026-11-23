import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import { RunSecrets } from "../../../domain/automation/secrets/run-secrets.js";
import { WorkflowInstanceRepository } from "../instances/ports.js";
import { SecretRepository } from "../secrets/ports.js";
import { EventOrigin } from "./enums.js";
import type { EmitEventCommand } from "./interfaces.js";
import { EventStore } from "./ports.js";

@Injectable()
export class EmitEvent {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly secrets: SecretRepository,
    private readonly events: EventStore,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: EmitEventCommand): Promise<void> {
    const now = new Date();
    const instance = await this.instances.find(command.instanceId);

    if (instance === null) return;

    const declared = await this.secrets.findDeclared(instance.versionId);
    const secrets = RunSecrets.of(declared);
    const masked = instance.masked(command.cloudEvent, secrets);
    await this.unitOfWork.run(() =>
      this.events.accept(masked, EventOrigin.Emit, instance.id, now),
    );
  }
}
