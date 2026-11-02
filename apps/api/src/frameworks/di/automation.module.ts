import { createRequire } from 'node:module';
import { Module } from '@nestjs/common';
import { AdvanceInstance } from '../../application/automation/instances/advance-instance.js';
import { WorkAnswers } from '../../application/automation/instances/work-answers.js';
import { BeginRound } from '../../application/automation/instances/begin-round.js';
import { CompleteSubWorkflow } from '../../application/automation/instances/complete-sub-workflow.js';
import { FaultInstance } from '../../application/automation/instances/fault-instance.js';
import { InstancePolicy } from '../../application/automation/instances/instance.policy.js';
import {
  InstanceRuns,
  ProcessRunner,
  ServiceCaller,
  WorkflowInstanceRepository,
} from '../../application/automation/instances/ports.js';
import {
  InstanceQueries,
  SubWorkflowQueries,
} from '../../application/automation/instances/queries.js';
import { RecordRound } from '../../application/automation/instances/record-round.js';
import { RunDetachedProcess } from '../../application/automation/instances/run-detached-process.js';
import { StartDetachedWorkflow } from '../../application/automation/instances/start-detached-workflow.js';
import { StartInstance } from '../../application/automation/instances/start-instance.js';
import { StartSubWorkflow } from '../../application/automation/instances/start-sub-workflow.js';
import {
  Clock,
  DefinitionReader,
  ExpressionEvaluator,
  SchemaValidator,
} from '../../application/automation/language/ports.js';
import { CheckDocument } from '../../application/automation/workflows/check-document.js';
import { GetConformanceStatement } from '../../application/automation/workflows/get-conformance-statement.js';
import {
  WorkflowRepository,
  WorkflowVersionRepository,
} from '../../application/automation/workflows/ports.js';
import { PublishVersion } from '../../application/automation/workflows/publish-version.js';
import {
  VersionDocuments,
  WorkflowQueries,
} from '../../application/automation/workflows/queries.js';
import { ReadVersionDefinition } from '../../application/automation/workflows/read-version-definition.js';
import { WorkflowPolicy } from '../../application/automation/workflows/workflow.policy.js';
import { ConformanceController } from '../../interface-adapters/api/controllers/conformance.controller.js';
import { InstancesController } from '../../interface-adapters/api/controllers/instances.controller.js';
import { WorkflowsController } from '../../interface-adapters/api/controllers/workflows.controller.js';
import { ProcessDetachedController } from '../../interface-adapters/messaging/process-detached.controller.js';
import { WorkflowDetachedController } from '../../interface-adapters/messaging/workflow-detached.controller.js';
import { DrizzleInstanceQueries } from '../../interface-adapters/persistence/queries/drizzle-instance.queries.js';
import { DrizzleWorkflowQueries } from '../../interface-adapters/persistence/queries/drizzle-workflow.queries.js';
import { DrizzleEventRepository } from '../../interface-adapters/persistence/repositories/drizzle-event.repository.js';
import { DrizzleWorkflowInstanceRepository } from '../../interface-adapters/persistence/repositories/drizzle-workflow-instance.repository.js';
import { DrizzleWorkflowVersionRepository } from '../../interface-adapters/persistence/repositories/drizzle-workflow-version.repository.js';
import { DrizzleWorkflowRepository } from '../../interface-adapters/persistence/repositories/drizzle-workflow.repository.js';
import { SandboxGateway } from '../../interface-adapters/sandbox/sandbox.gateway.js';
import { OpenWorkflowDefinitionReader } from '../../interface-adapters/workflows/definitions/open-workflow-definition.reader.js';
import { JqExpressionEvaluator } from '../../interface-adapters/workflows/expressions/jq-expression.evaluator.js';
import { EngineClock } from '../../interface-adapters/workflows/runs/engine.clock.js';
import { InstanceRunController } from '../../interface-adapters/workflows/runs/instance-run.controller.js';
import { InstanceRunsGateway } from '../../interface-adapters/workflows/runs/instance-runs.gateway.js';
import {
  PlatformRuntime,
  RunClient,
} from '../../interface-adapters/workflows/runs/interfaces.js';
import { JsonSchemaValidator } from '../../interface-adapters/workflows/schemas/json-schema.validator.js';
import { ServiceCallGateway } from '../../interface-adapters/workflows/services/service-call.gateway.js';
import { OutboxErrors } from '../outbox/outbox-errors.js';
import { ProcessDetachedOutboxHandler } from '../outbox/process-detached-outbox.handler.js';
import { WorkflowDetachedOutboxHandler } from '../outbox/workflow-detached-outbox.handler.js';
import { EngineRunClient } from '../workflows/engine-run.client.js';
import { InstanceWorkflow } from '../workflows/instance.workflow.js';
import { StepErrors } from '../workflows/step-errors.js';
import { AjvModule } from './ajv.module.js';
import { EngineModule } from './engine.module.js';
import { GoJudgeModule } from './go-judge.module.js';
import { JqModule } from './jq.module.js';
import { OpenWorkflowSpecModule } from './open-workflow-spec.module.js';
import { UndiciModule } from './undici.module.js';
import { ErrorClassifier } from '../resilience/error-classifier.js';

@Module({
  imports: [
    EngineModule,
    UndiciModule,
    GoJudgeModule,
    JqModule,
    AjvModule,
    OpenWorkflowSpecModule,
  ],
  controllers: [
    WorkflowsController,
    ConformanceController,
    InstancesController,
  ],
  providers: [
    WorkflowPolicy,
    InstancePolicy,
    { provide: Clock, useExisting: EngineClock },
    {
      provide: PlatformRuntime,
      useFactory: () => {
        // `$runtime.version` is the deployed API's own, as package.json states it.
        const manifest = createRequire(import.meta.url)(
          '../../../package.json',
        ) as { readonly version: string };
        const descriptor = {
          name: 'workflow-platform',
          version: manifest.version,
        };
        return { descriptor };
      },
    },
    OpenWorkflowDefinitionReader,
    { provide: DefinitionReader, useExisting: OpenWorkflowDefinitionReader },
    JqExpressionEvaluator,
    { provide: ExpressionEvaluator, useExisting: JqExpressionEvaluator },
    JsonSchemaValidator,
    { provide: SchemaValidator, useExisting: JsonSchemaValidator },
    ServiceCallGateway,
    { provide: ServiceCaller, useExisting: ServiceCallGateway },
    SandboxGateway,
    { provide: ProcessRunner, useExisting: SandboxGateway },
    ErrorClassifier,
    DrizzleWorkflowRepository,
    { provide: WorkflowRepository, useExisting: DrizzleWorkflowRepository },
    DrizzleWorkflowVersionRepository,
    {
      provide: WorkflowVersionRepository,
      useExisting: DrizzleWorkflowVersionRepository,
    },
    DrizzleWorkflowQueries,
    { provide: WorkflowQueries, useExisting: DrizzleWorkflowQueries },
    { provide: VersionDocuments, useExisting: DrizzleWorkflowQueries },
    DrizzleWorkflowInstanceRepository,
    {
      provide: WorkflowInstanceRepository,
      useExisting: DrizzleWorkflowInstanceRepository,
    },
    DrizzleEventRepository,
    DrizzleInstanceQueries,
    { provide: InstanceQueries, useExisting: DrizzleInstanceQueries },
    { provide: SubWorkflowQueries, useExisting: DrizzleInstanceQueries },
    EngineRunClient,
    { provide: RunClient, useExisting: EngineRunClient },
    InstanceRunsGateway,
    { provide: InstanceRuns, useExisting: InstanceRunsGateway },
    CheckDocument,
    PublishVersion,
    GetConformanceStatement,
    ReadVersionDefinition,
    StartInstance,
    BeginRound,
    RecordRound,
    WorkAnswers,
    AdvanceInstance,
    FaultInstance,
    StartSubWorkflow,
    CompleteSubWorkflow,
    RunDetachedProcess,
    StartDetachedWorkflow,
    InstanceRunController,
    StepErrors,
    InstanceWorkflow,
    ProcessDetachedController,
    WorkflowDetachedController,
    OutboxErrors,
    ProcessDetachedOutboxHandler,
    WorkflowDetachedOutboxHandler,
  ],
})
export class AutomationModule {}
