import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import { Missing } from "../enums.js";
import type { TurnResult, TurnWorkflowCommand } from "./interfaces.js";
import { WorkflowRepository } from "./ports.js";

@Injectable()
export class TurnWorkflowOn {
  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: TurnWorkflowCommand): Promise<TurnResult> {
    const workflow = await this.workflows.findByName(command.name);

    if (workflow === null) return { ok: false, failure: Missing.Workflow };

    const turned = workflow.turnOn();

    if (!turned.ok) return turned;

    if (turned.value)
      await this.unitOfWork.run(() => this.workflows.save(workflow));

    return { ok: true, value: undefined };
  }
}
