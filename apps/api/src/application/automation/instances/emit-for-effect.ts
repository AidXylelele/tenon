import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import { RunSecrets } from "../../../domain/automation/secrets/run-secrets.js";
import { EventOrigin } from "../events/enums.js";
import { EventStore } from "../events/ports.js";
import { SecretRepository } from "../secrets/ports.js";
import { EffectResult } from "./enums.js";
import type { EffectCommand } from "./interfaces.js";
import {
  InstanceRuns,
  WorkflowInstanceRepository,
  WorkflowRuntime,
} from "./ports.js";

@Injectable()
export class EmitForEffect {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly secrets: SecretRepository,
    private readonly runtime: WorkflowRuntime,
    private readonly events: EventStore,
    private readonly runs: InstanceRuns,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: EffectCommand): Promise<void> {
    const instance = await this.instances.find(command.instanceId);
    const request = instance?.requestOf(command.effectId) ?? null;

    if (instance === null || request === null) return;

    const declared = await this.secrets.findDeclared(instance.versionId);
    const secrets = RunSecrets.of(declared);
    const event = this.runtime.eventOf(request);
    const masked = instance.masked(event, secrets);
    const outcome = this.runtime.outcomeOf(EffectResult.Emitted);
    const answer = { effectId: command.effectId, outcome };
    const now = new Date();
    await this.unitOfWork.run(async () => {
      await this.events.accept(masked, EventOrigin.Emit, instance.id, now);
      await this.runs.respond(instance, answer);
    });
  }
}
