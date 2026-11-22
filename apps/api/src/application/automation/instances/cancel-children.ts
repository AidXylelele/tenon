import { Injectable } from "@nestjs/common";
import { Transactional } from "@nestjs-cls/transactional";
import { ChildCancellations, WorkflowInstanceRepository } from "./ports.js";
import type { InstanceCommand } from "./interfaces.js";

@Injectable()
export class CancelChildren {
  constructor(
    private readonly instances: WorkflowInstanceRepository,
    private readonly cancellations: ChildCancellations,
  ) {}

  @Transactional()
  async execute(command: InstanceCommand): Promise<void> {
    const parent = await this.instances.find(command.instanceId);

    if (parent === null) return;

    const children = await this.instances.findAwaitedChildren(parent.id);
    const abandoned = children.filter((child) => parent.abandons(child));
    await this.cancellations.request(abandoned);
  }
}
