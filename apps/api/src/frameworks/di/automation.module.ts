import { Module } from '@nestjs/common';
import { ArchiveWorkflow } from '../../application/automation/workflows/archive-workflow.js';
import { CheckDefinition } from '../../application/automation/workflows/check-definition.js';
import {
  DefinitionChecker,
  WorkflowRepository,
  WorkflowVersionRepository,
} from '../../application/automation/workflows/ports.js';
import { PublishVersion } from '../../application/automation/workflows/publish-version.js';
import { WorkflowQueries } from '../../application/automation/workflows/queries.js';
import { WorkflowPolicy } from '../../application/automation/workflows/workflow.policy.js';
import { Clock } from '../../application/automation/ports.js';
import { WorkflowsController } from '../../interface-adapters/api/controllers/workflows.controller.js';
import { DrizzleWorkflowQueries } from '../../interface-adapters/persistence/queries/drizzle-workflow.queries.js';
import { DrizzleWorkflowVersionRepository } from '../../interface-adapters/persistence/repositories/drizzle-workflow-version.repository.js';
import { DrizzleWorkflowRepository } from '../../interface-adapters/persistence/repositories/drizzle-workflow.repository.js';
import { RuntimeDefinitionChecker } from '../../interface-adapters/workflows/definitions/runtime-definition.checker.js';
import { EngineClock } from '../../interface-adapters/workflows/runs/engine.clock.js';
import { EngineModule } from './engine.module.js';
import { RuntimeModule } from './runtime.module.js';

@Module({
  imports: [EngineModule, RuntimeModule],
  controllers: [WorkflowsController],
  providers: [
    WorkflowPolicy,
    { provide: Clock, useExisting: EngineClock },
    RuntimeDefinitionChecker,
    { provide: DefinitionChecker, useExisting: RuntimeDefinitionChecker },
    DrizzleWorkflowRepository,
    { provide: WorkflowRepository, useExisting: DrizzleWorkflowRepository },
    DrizzleWorkflowVersionRepository,
    {
      provide: WorkflowVersionRepository,
      useExisting: DrizzleWorkflowVersionRepository,
    },
    DrizzleWorkflowQueries,
    { provide: WorkflowQueries, useExisting: DrizzleWorkflowQueries },
    CheckDefinition,
    PublishVersion,
    ArchiveWorkflow,
  ],
})
export class AutomationModule {}
