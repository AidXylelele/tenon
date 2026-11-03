import { Injectable } from '@nestjs/common';
import { Workflow } from '../../../domain/automation/workflows/workflow.js';
import { Clock } from '../ports.js';
import {
  DefinitionChecker,
  type PublishResult,
  type PublishVersionCommand,
  WorkflowRepository,
  WorkflowVersionRepository,
} from './ports.js';

// Everything publishing would decide, and nothing saved (FR-003).
@Injectable()
export class CheckDefinition {
  constructor(
    private readonly checker: DefinitionChecker,
    private readonly workflows: WorkflowRepository,
    private readonly versions: WorkflowVersionRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: PublishVersionCommand): Promise<PublishResult> {
    const now = this.clock.now();
    const checked = await this.checker.check(command.document);

    if (!checked.ok) return checked;

    const definition = checked.value;
    const found = await this.workflows.findByName(definition.name);
    const workflow = found ?? Workflow.register(definition.name);
    const existing = await this.versions.find(
      definition.name,
      definition.version,
    );
    const published = workflow.publish({
      definition,
      existing,
      publisherId: command.publisherId,
      now,
    });

    if (!published.ok) return published;

    return { ok: true, value: { workflow, publication: published.value } };
  }
}
