import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import { RunSecrets } from "../../../domain/automation/secrets/run-secrets.js";
import { Control } from "../../../domain/automation/instances/enums.js";
import { Missing } from "../enums.js";
import { SecretRepository } from "../secrets/ports.js";
import type { InstanceCommand, InstanceResult } from "./interfaces.js";
import {
  InstanceRuns,
  WorkflowInstanceRepository,
  WorkflowRuntime,
} from "./ports.js";

@Injectable()
export class ResumeInstance {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly runtime: WorkflowRuntime,
    private readonly secrets: SecretRepository,
    private readonly runs: InstanceRuns,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: InstanceCommand): Promise<InstanceResult> {
    const instance = await this.instances.find(command.instanceId);

    if (instance === null) return { ok: false, failure: Missing.Instance };

    const admitted = instance.admits(Control.Resume);

    if (!admitted.ok) return admitted;

    const declared = await this.secrets.findDeclared(instance.versionId);
    const secrets = RunSecrets.of(declared);
    const now = new Date();
    const turn = await this.runtime.resume(instance, secrets, now);
    instance.advance(turn, secrets, now);
    await this.unitOfWork.run(async () => {
      await this.instances.save(instance);
      await this.runs.wakeOnControl(instance, Control.Resume);
    });
    return { ok: true, value: undefined };
  }
}
