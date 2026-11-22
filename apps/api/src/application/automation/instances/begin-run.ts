import { Injectable } from "@nestjs/common";
import { Transactional } from "@nestjs-cls/transactional";
import { RunSecrets } from "../../../domain/automation/secrets/run-secrets.js";
import { Missing } from "../enums.js";
import { SecretRepository } from "../secrets/ports.js";
import type { AgendaResult, RunCommand } from "./interfaces.js";
import { WorkflowInstanceRepository, WorkflowRuntime } from "./ports.js";

@Injectable()
export class BeginRun {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly runtime: WorkflowRuntime,
    private readonly secrets: SecretRepository,
  ) {}

  @Transactional()
  async execute(command: RunCommand): Promise<AgendaResult> {
    const instance = await this.instances.find(command.instanceId);

    if (instance === null) return { ok: false, failure: Missing.Instance };

    if (!instance.pending) return { ok: true, value: instance.agenda };

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
    await this.instances.save(instance);
    return { ok: true, value: instance.agenda };
  }
}
