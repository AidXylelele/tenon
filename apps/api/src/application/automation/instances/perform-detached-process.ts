import { Injectable } from "@nestjs/common";
import { RunSecrets } from "../../../domain/automation/secrets/run-secrets.js";
import { SecretRepository } from "../secrets/ports.js";
import type { DetachedProcessCommand } from "./interfaces.js";
import { EffectPerformer } from "./ports.js";

@Injectable()
export class PerformDetachedProcess {
  constructor(
    private readonly secrets: SecretRepository,
    private readonly performer: EffectPerformer,
  ) {}

  async execute(command: DetachedProcessCommand): Promise<void> {
    const declared = await this.secrets.findDeclared(command.versionId);
    const secrets = RunSecrets.of(declared);
    const call = {
      instanceId: command.instanceId,
      effectId: command.effectId,
      signal: command.signal,
      secrets,
    };
    await this.performer.performDetached(command.request, call);
  }
}
