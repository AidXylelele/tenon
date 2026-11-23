import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import type { InstanceCommand } from "./interfaces.js";
import { InstanceRuns, WorkflowInstanceRepository } from "./ports.js";

@Injectable()
export class WakeParent {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly runs: InstanceRuns,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: InstanceCommand): Promise<void> {
    const child = await this.instances.find(command.instanceId);

    if (!child?.ended) return;

    const parentId = child.awaitedBy;

    if (parentId === null) return;

    const parent = await this.instances.find(parentId);

    if (parent === null || parent.ended) return;

    await this.unitOfWork.run(() => this.runs.wakeOnChild(parent, child));
  }
}
