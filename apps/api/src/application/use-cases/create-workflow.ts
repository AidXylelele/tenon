import { Workflow } from '../../domain/workflow.js';
import type {
  CreateWorkflowCommand,
  WorkflowRepository,
} from '../interfaces.js';

export class CreateWorkflow {
  constructor(private readonly workflows: WorkflowRepository) {}

  async execute(command: CreateWorkflowCommand): Promise<Workflow> {
    const workflow = Workflow.create({
      name: command.name,
      ownerId: command.actor.id,
    });
    await this.workflows.add(workflow);
    return workflow;
  }
}
