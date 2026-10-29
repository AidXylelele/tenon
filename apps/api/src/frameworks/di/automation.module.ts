import { Module, type OnApplicationShutdown } from '@nestjs/common';
import { ExpressionEvaluator } from '../../application/automation/language/ports.js';
import { CheckDocument } from '../../application/automation/workflows/check-document.js';
import { GetConformanceStatement } from '../../application/automation/workflows/get-conformance-statement.js';
import {
  DocumentReader,
  WorkflowRepository,
  WorkflowVersionRepository,
} from '../../application/automation/workflows/ports.js';
import { PublishVersion } from '../../application/automation/workflows/publish-version.js';
import { WorkflowQueries } from '../../application/automation/workflows/queries.js';
import { WorkflowPolicy } from '../../application/automation/workflows/workflow.policy.js';
import { DslDocumentReader } from '../../interface-adapters/documents/dsl-document.reader.js';
import { JqExpressionEvaluator } from '../../interface-adapters/expressions/jq-expression.evaluator.js';
import { ConformanceController } from '../../interface-adapters/http/controllers/conformance.controller.js';
import { WorkflowsController } from '../../interface-adapters/http/controllers/workflows.controller.js';
import { DslSchema, JqPool } from '../../interface-adapters/interfaces.js';
import { DrizzleWorkflowQueries } from '../../interface-adapters/persistence/queries/drizzle-workflow.queries.js';
import { DrizzleWorkflowRepository } from '../../interface-adapters/persistence/repositories/drizzle-workflow.repository.js';
import { DrizzleWorkflowVersionRepository } from '../../interface-adapters/persistence/repositories/drizzle-workflow-version.repository.js';
import { createDslSchema } from '../ajv/dsl-schema.js';
import { createJqPool } from '../jq/jq-pool.js';

@Module({
  controllers: [WorkflowsController, ConformanceController],
  providers: [
    WorkflowPolicy,
    { provide: JqPool, useFactory: createJqPool },
    { provide: DslSchema, useFactory: createDslSchema },
    DslDocumentReader,
    { provide: DocumentReader, useExisting: DslDocumentReader },
    JqExpressionEvaluator,
    { provide: ExpressionEvaluator, useExisting: JqExpressionEvaluator },
    DrizzleWorkflowRepository,
    { provide: WorkflowRepository, useExisting: DrizzleWorkflowRepository },
    DrizzleWorkflowVersionRepository,
    {
      provide: WorkflowVersionRepository,
      useExisting: DrizzleWorkflowVersionRepository,
    },
    DrizzleWorkflowQueries,
    { provide: WorkflowQueries, useExisting: DrizzleWorkflowQueries },
    CheckDocument,
    PublishVersion,
    GetConformanceStatement,
  ],
})
export class AutomationModule implements OnApplicationShutdown {
  constructor(private readonly pool: JqPool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.destroy();
  }
}
