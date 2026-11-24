import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import { Missing } from "../enums.js";
import type { TurnResult, TurnWorkflowCommand } from "./interfaces.js";
import { WorkflowEvents, WorkflowRepository } from "./ports.js";

@Injectable()
export class TurnWorkflowOn {
  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly events: WorkflowEvents,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: TurnWorkflowCommand): Promise<TurnResult> {
    const workflow = await this.workflows.findByName(command.name);

    if (workflow === null) return { ok: false, failure: Missing.Workflow };

    const now = new Date();
    const turned = workflow.turnOn(now);

    if (!turned.ok) return turned;

    if (turned.value)
      await this.unitOfWork.run(async () => {
        await this.workflows.save(workflow);
        await this.events.dispatch(workflow);
      });

    return { ok: true, value: undefined };
  }
}
