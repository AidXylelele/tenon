import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import { RunSecrets } from "../../../domain/automation/secrets/run-secrets.js";
import { Control } from "../../../domain/automation/instances/enums.js";
import { Missing } from "../enums.js";
import { SecretRepository } from "../secrets/ports.js";
import type { CancelInstanceCommand, InstanceResult } from "./interfaces.js";
import { InstanceEvents } from "./instance-events.js";
import { WorkflowInstanceRepository, WorkflowRuntime } from "./ports.js";

@Injectable()
export class CancelInstance {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly runtime: WorkflowRuntime,
    private readonly secrets: SecretRepository,
    private readonly events: InstanceEvents,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: CancelInstanceCommand): Promise<InstanceResult> {
    const instance = await this.instances.find(command.instanceId);

    if (instance === null) return { ok: false, failure: Missing.Instance };

    const admitted = instance.admits(Control.Cancel);

    if (!admitted.ok) return admitted;

    const now = new Date();

    if (instance.pending) instance.cancel(now);

    if (!instance.ended) {
      const declared = await this.secrets.findDeclared(instance.versionId);
      const secrets = RunSecrets.of(declared);
      const turn = await this.runtime.cancel(
        instance,
        secrets,
        now,
        command.signal,
      );
      instance.advance(turn, secrets, now);
    }

    await this.unitOfWork.run(async () => {
      await this.instances.save(instance);
      await this.events.dispatch(instance);
    });
    return { ok: true, value: undefined };
  }
}
