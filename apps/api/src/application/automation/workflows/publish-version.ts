import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { SourceDocument } from '../../../domain/automation/workflows/source-document.js';
import { Workflow } from '../../../domain/automation/workflows/workflow.js';
import { Clock } from '../language/ports.js';
import { CheckDocument } from './check-document.js';
import {
  type PublishedVersionResult,
  type PublishVersionCommand,
  WorkflowRepository,
  WorkflowVersionRepository,
} from './ports.js';

@Injectable()
export class PublishVersion {
  constructor(
    private readonly checkDocument: CheckDocument,
    private readonly workflows: WorkflowRepository,
    private readonly versions: WorkflowVersionRepository,
    private readonly clock: Clock,
  ) {}

  @Transactional()
  async execute(
    command: PublishVersionCommand,
  ): Promise<PublishedVersionResult> {
    const now = this.clock.now();
    const source = new SourceDocument({
      format: command.format,
      text: command.text,
    });
    const definition = await this.checkDocument.execute(command);
    const found = await this.workflows.findByName(definition.workflow);
    const workflow = found ?? Workflow.register(definition.workflow);
    const existing = await this.versions.find(
      definition.workflow,
      definition.version,
    );

    if (existing) {
      existing.confirmSame(source);
      const current = workflow.isCurrent(existing);
      return { workflow, version: existing, created: false, current };
    }

    const version = workflow.publish({
      definition,
      source,
      publisherId: command.publisherId,
      now,
    });
    await this.workflows.save(workflow);
    await this.versions.add(version);
    const current = workflow.isCurrent(version);
    return { workflow, version, created: true, current };
  }
}
