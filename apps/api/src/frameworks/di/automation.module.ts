import { Module } from '@nestjs/common';
import {
  DefinitionReader,
  ExpressionEvaluator,
} from '../../application/automation/language/ports.js';
import { CheckDocument } from '../../application/automation/workflows/check-document.js';
import { GetConformanceStatement } from '../../application/automation/workflows/get-conformance-statement.js';
import {
  WorkflowRepository,
  WorkflowVersionRepository,
} from '../../application/automation/workflows/ports.js';
import { PublishVersion } from '../../application/automation/workflows/publish-version.js';
import { WorkflowQueries } from '../../application/automation/workflows/queries.js';
import { WorkflowPolicy } from '../../application/automation/workflows/workflow.policy.js';
import { OpenWorkflowClient } from '../../interface-adapters/documents/interfaces.js';
import { OpenWorkflowDefinitionReader } from '../../interface-adapters/documents/open-workflow-definition.reader.js';
import { JqClient } from '../../interface-adapters/expressions/interfaces.js';
import { JqExpressionEvaluator } from '../../interface-adapters/expressions/jq-expression.evaluator.js';
import { ConformanceController } from '../../interface-adapters/http/controllers/conformance.controller.js';
import { WorkflowsController } from '../../interface-adapters/http/controllers/workflows.controller.js';
import { DrizzleWorkflowQueries } from '../../interface-adapters/persistence/queries/drizzle-workflow.queries.js';
import { DrizzleWorkflowRepository } from '../../interface-adapters/persistence/repositories/drizzle-workflow.repository.js';
import { DrizzleWorkflowVersionRepository } from '../../interface-adapters/persistence/repositories/drizzle-workflow-version.repository.js';
import { InProcessJqClient } from '../jq/in-process-jq.client.js';
import { SdkOpenWorkflowClient } from '../openworkflowspec/sdk-open-workflow.client.js';

@Module({
  controllers: [WorkflowsController, ConformanceController],
  providers: [
    WorkflowPolicy,
    { provide: OpenWorkflowClient, useClass: SdkOpenWorkflowClient },
    { provide: JqClient, useClass: InProcessJqClient },
    OpenWorkflowDefinitionReader,
    { provide: DefinitionReader, useExisting: OpenWorkflowDefinitionReader },
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
export class AutomationModule {}
