import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CheckDefinition } from './check-definition.js';
import {
  type PublishResult,
  type PublishVersionCommand,
  WorkflowRepository,
  WorkflowVersionRepository,
} from './ports.js';

@Injectable()
export class PublishVersion {
  constructor(
    private readonly checkDefinition: CheckDefinition,
    private readonly workflows: WorkflowRepository,
    private readonly versions: WorkflowVersionRepository,
  ) {}

  @Transactional()
  async execute(command: PublishVersionCommand): Promise<PublishResult> {
    const prepared = await this.checkDefinition.execute(command);

    if (!prepared.ok) return prepared;

    const publication = prepared.value.publication;

    // The same document again: the version is published already, nothing changes.
    if (!publication.created) return prepared;

    await this.workflows.save(prepared.value.workflow);
    await this.versions.add(publication.version);
    return prepared;
  }
}
