import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { Missing } from '../enums.js';
import { WorkflowRepository } from './ports.js';
import type { TurnResult, TurnWorkflowCommand } from './turn-workflow-on.js';

// Automatic starts off (FR-006); running instances and manual starts go on.
@Injectable()
export class TurnWorkflowOff {
  constructor(private readonly workflows: WorkflowRepository) {}

  @Transactional()
  async execute(command: TurnWorkflowCommand): Promise<TurnResult> {
    const workflow = await this.workflows.findByName(command.name);

    if (workflow === null) return { ok: false, failure: Missing.Workflow };

    const turned = workflow.turnOff();

    if (turned) await this.workflows.save(workflow);

    return { ok: true, value: undefined };
  }
}
