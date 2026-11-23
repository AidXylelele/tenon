import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import { RunSecrets } from "../../../domain/automation/secrets/run-secrets.js";
import { SecretRepository } from "../secrets/ports.js";
import { EffectResult } from "./enums.js";
import type { EffectCommand } from "./interfaces.js";
import {
  EffectClient,
  InstanceRuns,
  WorkflowInstanceRepository,
  WorkflowRuntime,
} from "./ports.js";

@Injectable()
export class StartDetachedProcess {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly secrets: SecretRepository,
    private readonly performer: EffectClient,
    private readonly runtime: WorkflowRuntime,
    private readonly runs: InstanceRuns,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: EffectCommand): Promise<void> {
    const instance = await this.instances.find(command.instanceId);
    const request = instance?.requestOf(command.effectId) ?? null;

    if (instance === null || request === null) return;

    const declared = await this.secrets.findDeclared(instance.versionId);
    const secrets = RunSecrets.of(declared);
    const idempotencyKey = `${instance.id}:${command.effectId}`;
    const call = { idempotencyKey, signal: command.signal, secrets };
    await this.performer.performDetached(request, call);
    const outcome = this.runtime.outcomeOf(EffectResult.Started);
    const answer = { effectId: command.effectId, outcome };
    await this.unitOfWork.run(() => this.runs.respond(instance, answer));
  }
}
