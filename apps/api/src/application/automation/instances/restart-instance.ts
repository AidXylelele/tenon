import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import { Missing } from "../enums.js";
import { WorkflowRepository } from "../workflows/ports.js";
import type { RestartInstanceCommand, StartResult } from "./interfaces.js";
import { InstanceEvents } from "./instance-events.js";
import { WorkflowInstanceRepository } from "./ports.js";

@Injectable()
export class RestartInstance {
  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly instances: WorkflowInstanceRepository,
    private readonly events: InstanceEvents,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: RestartInstanceCommand): Promise<StartResult> {
    const previous = await this.instances.find(command.instanceId);

    if (previous === null) return { ok: false, failure: Missing.Instance };

    const workflow = await this.workflows.findById(previous.workflowId);

    if (workflow === null) return { ok: false, failure: Missing.Workflow };

    const version = workflow.versionById(previous.versionId);

    if (version === null) return { ok: false, failure: Missing.Version };

    const now = new Date();
    const restarted = workflow.restartInstance({
      previous,
      version,
      starterId: command.starterId,
      now,
    });

    if (!restarted.ok) return restarted;

    const instance = restarted.value;
    await this.unitOfWork.run(async () => {
      await this.instances.save(instance);
      await this.events.dispatch(instance);
    });
    return { ok: true, value: { instanceId: instance.id } };
  }
}
