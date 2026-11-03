import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import type { WorkflowRefusal } from '../../../domain/automation/workflows/enums.js';
import type { WorkflowName } from '../../../domain/automation/workflows/workflow-name.js';
import type { Result } from '../../../domain/result.js';
import { Missing } from '../enums.js';
import { WorkflowRepository } from './ports.js';

export interface TurnWorkflowCommand {
  readonly name: WorkflowName;
}

export type TurnResult = Result<undefined, WorkflowRefusal | Missing>;

// Automatic starts on (FR-006): the engine learns of it after the commit, through the outbox.
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
