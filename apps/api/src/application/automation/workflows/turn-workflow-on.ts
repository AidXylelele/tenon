import { Injectable } from "@nestjs/common";
import { Transactional } from "@nestjs-cls/transactional";
import { Missing } from "../enums.js";
import type { TurnResult, TurnWorkflowCommand } from "./interfaces.js";
import { WorkflowRepository } from "./ports.js";

@Injectable()
export class TurnWorkflowOn {
  constructor(private readonly workflows: WorkflowRepository) {}

  @Transactional()
  async execute(command: TurnWorkflowCommand): Promise<TurnResult> {
    const workflow = await this.workflows.findByName(command.name);

    if (workflow === null) return { ok: false, failure: Missing.Workflow };

    const turned = workflow.turnOn();

    if (!turned.ok) return turned;

    if (turned.value) await this.workflows.save(workflow);

    return { ok: true, value: undefined };
  }
}
