import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { SourceDocument } from '../../../domain/automation/workflows/source-document.js';
import { Workflow } from '../../../domain/automation/workflows/workflow.js';
import { WorkflowVersion } from '../../../domain/automation/workflows/workflow-version.js';
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
  ) {}

  @Transactional()
  async execute(
    command: PublishVersionCommand,
  ): Promise<PublishedVersionResult> {
    const now = new Date();
    const source = SourceDocument.of(command.format, command.text);
    const report = await this.checkDocument.execute(command);
    const definition = report.publishable();
    const found = await this.workflows.findByName(definition.workflow);
    const workflow = found ?? Workflow.register(definition.workflow);
    const existing = await this.versions.find(
      definition.workflow,
      definition.version,
    );

    if (existing) {
      existing.confirmSame(source);
      const current = workflow.isCurrent(existing);
      return { version: existing, created: false, current };
    }

    const version = WorkflowVersion.publish({
      workflow,
      definition,
      source,
      publisherId: command.publisherId,
      now,
    });
    workflow.publish(version);
    await this.workflows.save(workflow);
    await this.versions.add(version);
    const current = workflow.isCurrent(version);
    return { version, created: true, current };
  }
}
