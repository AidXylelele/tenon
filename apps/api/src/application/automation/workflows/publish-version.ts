import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { CheckDefinition } from './check-definition.js';
import {
  type PublishResult,
  type PublishVersionCommand,
  WorkflowRepository,
  WorkflowVersionRepository,
} from './ports.js';

// The checks run before any transaction, so a large document holds no connection while it is
// compiled; the workflow's version fence and the unique version keep a concurrent publish out.
@Injectable()
export class PublishVersion {
  constructor(
    private readonly checkDefinition: CheckDefinition,
    private readonly workflows: WorkflowRepository,
    private readonly versions: WorkflowVersionRepository,
    private readonly transactions: TransactionHost,
  ) {}

  async execute(command: PublishVersionCommand): Promise<PublishResult> {
    const prepared = await this.checkDefinition.execute(command);

    if (!prepared.ok) return prepared;

    const workflow = prepared.value.workflow;
    const publication = prepared.value.publication;

    // The same document again: the version is published already, nothing changes.
    if (!publication.created) return prepared;

    await this.transactions.withTransaction(async () => {
      await this.workflows.save(workflow);
      await this.versions.add(publication.version);
    });
    return prepared;
  }
}
