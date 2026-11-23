import { Injectable } from "@nestjs/common";
import type { EffectKind } from "../../../domain/automation/instances/enums.js";
import type { EffectReference } from "./interfaces.js";
import { WorkflowInstanceRepository } from "./ports.js";

@Injectable()
export class FindEffectKind {
  constructor(private readonly instances: WorkflowInstanceRepository) {}

  async execute(reference: EffectReference): Promise<EffectKind | null> {
    const instance = await this.instances.find(reference.instanceId);
    return instance?.kindOf(reference.effectId) ?? null;
  }
}
