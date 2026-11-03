import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { Missing } from '../enums.js';
import { Clock } from '../ports.js';
import {
  type ArchiveResult,
  type ArchiveWorkflowCommand,
  WorkflowRepository,
} from './ports.js';

@Injectable()
export class ArchiveWorkflow {
  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly clock: Clock,
  ) {}

  @Transactional()
  async execute(command: ArchiveWorkflowCommand): Promise<ArchiveResult> {
    const now = this.clock.now();
    const workflow = await this.workflows.findByName(command.name);

    if (workflow === null) return { ok: false, failure: Missing.Workflow };

    const archived = workflow.archive(now);

    if (archived) await this.workflows.save(workflow);

    return { ok: true, value: undefined };
  }
}
