import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import { Missing } from "../enums.js";
import { WorkflowRepository } from "../workflows/ports.js";
import type { StartChildCommand, StartResult } from "./interfaces.js";
import { InstanceRuns, WorkflowInstanceRepository } from "./ports.js";

@Injectable()
export class StartSubWorkflow {
  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly instances: WorkflowInstanceRepository,
    private readonly runs: InstanceRuns,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: StartChildCommand): Promise<StartResult> {
    const existing = await this.instances.findChild(
      command.parentId,
      command.effectId,
    );

    if (existing !== null)
      return { ok: true, value: { instanceId: existing.id } };

    const workflow = await this.workflows.findByName(command.name);

    if (workflow === null) return { ok: false, failure: Missing.Workflow };

    const version = workflow.versionToRun(command.version);

    if (version === null) return { ok: false, failure: Missing.Version };

    const now = new Date();
    const started = workflow.startInstance({
      instanceId: null,
      version,
      input: command.input,
      trigger: command.trigger,
      starterId: null,
      originId: command.parentId,
      originEffectId: command.effectId,
      now,
    });

    if (!started.ok) return started;

    const child = started.value;
    await this.unitOfWork.run(async () => {
      await this.instances.save(child);
      await this.runs.start(child);
    });
    return { ok: true, value: { instanceId: child.id } };
  }
}
