import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import { WorkflowEvents, WorkflowRepository } from "../workflows/ports.js";
import type { FireScheduleCommand } from "./interfaces.js";

@Injectable()
export class FireSchedule {
  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly events: WorkflowEvents,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: FireScheduleCommand): Promise<void> {
    const workflow = await this.workflows.findById(command.workflowId);

    if (workflow === null) return;

    const now = new Date();
    const fired = workflow.fireSchedule({
      arming: command.arming,
      at: command.at,
      now,
    });

    if (!fired.ok) return;

    await this.unitOfWork.run(async () => {
      await this.workflows.save(workflow);
      await this.events.dispatch(workflow);
    });
  }
}
