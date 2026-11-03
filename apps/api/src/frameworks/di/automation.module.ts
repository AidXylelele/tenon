import { Module } from '@nestjs/common';
import { AcceptEvent } from '../../application/automation/events/accept-event.js';
import { DispatchEvent } from '../../application/automation/events/dispatch-event.js';
import { Listen } from '../../application/automation/events/listen.js';
import { Unlisten } from '../../application/automation/events/unlisten.js';
import { EventDispatchController } from '../../interface-adapters/messaging/event-dispatch.controller.js';
import { DrizzleListenerStore } from '../../interface-adapters/persistence/stores/drizzle-listener.store.js';
import { EventDeliveriesGateway } from '../../interface-adapters/workflows/runs/event-deliveries.gateway.js';
import { EventDispatchOutboxHandler } from '../outbox/event-dispatch.outbox.handler.js';
import {
  EventDeliveries,
  EventStore,
  ListenerStore,
} from '../../application/automation/events/ports.js';
import { EventQueries } from '../../application/automation/events/queries.js';
import { BeginInstance } from '../../application/automation/instances/begin-instance.js';
import { CreateWebhook } from '../../application/automation/webhooks/create-webhook.js';
import { DeleteWebhook } from '../../application/automation/webhooks/delete-webhook.js';
import { WebhookRepository } from '../../application/automation/webhooks/ports.js';
import { WebhookQueries } from '../../application/automation/webhooks/queries.js';
import { ReceiveWebhookCall } from '../../application/automation/webhooks/receive-webhook-call.js';
import { WebhookPolicy } from '../../application/automation/webhooks/webhook.policy.js';
import { HooksController } from '../../interface-adapters/api/controllers/hooks.controller.js';
import { WebhooksController } from '../../interface-adapters/api/controllers/webhooks.controller.js';
import { DrizzleWebhookQueries } from '../../interface-adapters/persistence/queries/drizzle-webhook.queries.js';
import { DrizzleWebhookRepository } from '../../interface-adapters/persistence/repositories/drizzle-webhook.repository.js';
import { EventsController } from '../../interface-adapters/api/controllers/events.controller.js';
import { DrizzleEventQueries } from '../../interface-adapters/persistence/queries/drizzle-event.queries.js';
import { DrizzleInstanceNames } from '../../interface-adapters/persistence/queries/drizzle-instance-names.query.js';
import { DrizzleEventStore } from '../../interface-adapters/persistence/stores/drizzle-event.store.js';
import { BeginWaiting } from '../../application/automation/instances/begin-waiting.js';
import { CancelInstance } from '../../application/automation/instances/cancel-instance.js';
import { CompleteInstance } from '../../application/automation/instances/complete-instance.js';
import { DeleteInstance } from '../../application/automation/instances/delete-instance.js';
import { EndWaiting } from '../../application/automation/instances/end-waiting.js';
import { FaultInstance } from '../../application/automation/instances/fault-instance.js';
import { InstanceDirective } from '../../application/automation/instances/instance-directive.js';
import { InstancePolicy } from '../../application/automation/instances/instance.policy.js';
import {
  InstanceRuns,
  TaskProgress,
  WorkflowInstanceRepository,
} from '../../application/automation/instances/ports.js';
import { InstanceQueries } from '../../application/automation/instances/queries.js';
import { RecordTaskEnd } from '../../application/automation/instances/record-task-end.js';
import { RecordTaskStart } from '../../application/automation/instances/record-task-start.js';
import { RestartInstance } from '../../application/automation/instances/restart-instance.js';
import { ResumeInstance } from '../../application/automation/instances/resume-instance.js';
import { StartInstance } from '../../application/automation/instances/start-instance.js';
import { StartSubWorkflow } from '../../application/automation/instances/start-sub-workflow.js';
import { SuspendInstance } from '../../application/automation/instances/suspend-instance.js';
import { Clock } from '../../application/automation/ports.js';
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
import { InstancesController } from '../../interface-adapters/api/controllers/instances.controller.js';
import { WorkflowsController } from '../../interface-adapters/api/controllers/workflows.controller.js';
import { DrizzleInstanceQueries } from '../../interface-adapters/persistence/queries/drizzle-instance.queries.js';
import { DrizzleWorkflowQueries } from '../../interface-adapters/persistence/queries/drizzle-workflow.queries.js';
import { DrizzleWorkflowInstanceRepository } from '../../interface-adapters/persistence/repositories/drizzle-workflow-instance.repository.js';
import { DrizzleWorkflowVersionRepository } from '../../interface-adapters/persistence/repositories/drizzle-workflow-version.repository.js';
import { DrizzleWorkflowRepository } from '../../interface-adapters/persistence/repositories/drizzle-workflow.repository.js';
import { DrizzleTaskProgressStore } from '../../interface-adapters/persistence/stores/drizzle-task-progress.store.js';
import { RuntimeDefinitionChecker } from '../../interface-adapters/workflows/definitions/runtime-definition.checker.js';
import { RunClient } from '../../interface-adapters/workflows/interfaces.js';
import { EngineClock } from '../../interface-adapters/workflows/runs/engine.clock.js';
import { InstanceRunController } from '../../interface-adapters/workflows/runs/instance-run.controller.js';
import { InstanceRunsGateway } from '../../interface-adapters/workflows/runs/instance-runs.gateway.js';
import { InstanceEventsOutboxHandler } from '../outbox/instance-events.outbox.handler.js';
import { OutboxErrors } from '../outbox/outbox-errors.js';
import { ErrorClassifier } from '../resilience/error-classifier.js';
import { EngineRunClient } from '../workflows/engine-run.client.js';
import { InstanceWorkflow } from '../workflows/instance.workflow.js';
import { ProcessWorkflow } from '../workflows/process.workflow.js';
import { StepErrors } from '../workflows/step-errors.js';
import { EngineModule } from './engine.module.js';
import { RuntimeModule } from './runtime.module.js';

@Module({
  imports: [EngineModule, RuntimeModule],
  controllers: [
    WorkflowsController,
    InstancesController,
    EventsController,
    WebhooksController,
    HooksController,
  ],
  providers: [
    WorkflowPolicy,
    InstancePolicy,
    WebhookPolicy,
    { provide: Clock, useExisting: EngineClock },
    CreateWebhook,
    DeleteWebhook,
    ReceiveWebhookCall,
    DrizzleWebhookRepository,
    { provide: WebhookRepository, useExisting: DrizzleWebhookRepository },
    DrizzleWebhookQueries,
    { provide: WebhookQueries, useExisting: DrizzleWebhookQueries },
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
    DrizzleWorkflowInstanceRepository,
    {
      provide: WorkflowInstanceRepository,
      useExisting: DrizzleWorkflowInstanceRepository,
    },
    DrizzleEventStore,
    { provide: EventStore, useExisting: DrizzleEventStore },
    DrizzleEventQueries,
    { provide: EventQueries, useExisting: DrizzleEventQueries },
    DrizzleInstanceNames,
    AcceptEvent,
    DispatchEvent,
    Listen,
    Unlisten,
    DrizzleListenerStore,
    { provide: ListenerStore, useExisting: DrizzleListenerStore },
    EventDeliveriesGateway,
    { provide: EventDeliveries, useExisting: EventDeliveriesGateway },
    EventDispatchController,
    EventDispatchOutboxHandler,
    DrizzleTaskProgressStore,
    { provide: TaskProgress, useExisting: DrizzleTaskProgressStore },
    DrizzleInstanceQueries,
    { provide: InstanceQueries, useExisting: DrizzleInstanceQueries },
    EngineRunClient,
    { provide: RunClient, useExisting: EngineRunClient },
    InstanceRunsGateway,
    { provide: InstanceRuns, useExisting: InstanceRunsGateway },
    CheckDefinition,
    PublishVersion,
    ArchiveWorkflow,
    StartInstance,
    RestartInstance,
    CancelInstance,
    SuspendInstance,
    ResumeInstance,
    DeleteInstance,
    BeginInstance,
    RecordTaskStart,
    RecordTaskEnd,
    BeginWaiting,
    EndWaiting,
    InstanceDirective,
    CompleteInstance,
    FaultInstance,
    StartSubWorkflow,
    InstanceRunController,
    ErrorClassifier,
    StepErrors,
    InstanceWorkflow,
    ProcessWorkflow,
    OutboxErrors,
    InstanceEventsOutboxHandler,
  ],
})
export class AutomationModule {}
