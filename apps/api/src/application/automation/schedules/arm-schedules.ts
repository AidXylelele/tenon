import { Injectable } from "@nestjs/common";
import { UnitOfWork } from "../../unit-of-work.js";
import { WorkflowEvents, WorkflowRepository } from "../workflows/ports.js";
import { WorkflowQueries } from "../workflows/queries.js";

@Injectable()
export class ArmSchedules {
  constructor(
    private readonly queries: WorkflowQueries,
    private readonly workflows: WorkflowRepository,
    private readonly events: WorkflowEvents,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(): Promise<void> {
    const unarmed = await this.queries.unarmedSchedules();

    for (const workflowId of unarmed) {
      const workflow = await this.workflows.findById(workflowId);
      const now = new Date();
      const scheduled = workflow?.armSchedule(now) ?? false;

      if (workflow === null || !scheduled) continue;

      await this.unitOfWork.run(async () => {
        await this.workflows.save(workflow);
        await this.events.dispatch(workflow);
      });
    }
  }
}
