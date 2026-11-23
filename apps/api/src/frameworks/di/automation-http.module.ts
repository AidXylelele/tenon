import { Module } from "@nestjs/common";
import { ConfigModule, type ConfigType } from "@nestjs/config";
import { CreateDraft } from "../../application/automation/drafts/create-draft.js";
import { DraftRepository } from "../../application/automation/drafts/ports.js";
import { DraftCompilation } from "../../application/automation/drafts/draft-compilation.js";
import { PublishDraft } from "../../application/automation/drafts/publish-draft.js";
import { DraftQueries } from "../../application/automation/drafts/queries.js";
import { SaveDraft } from "../../application/automation/drafts/save-draft.js";
import { TestDraft } from "../../application/automation/drafts/test-draft.js";
import { AcceptEvent } from "../../application/automation/events/accept-event.js";
import { EventQueries } from "../../application/automation/events/queries.js";
import {
  HostCapabilities,
  HostLimits,
  ProcessPlatform,
} from "../../application/automation/host/queries.js";
import { FetchImport } from "../../application/automation/imports/fetch-import.js";
import { ImportFetcher } from "../../application/automation/imports/ports.js";
import { DeleteInstance } from "../../application/automation/instances/delete-instance.js";
import { InstanceQueries } from "../../application/automation/instances/queries.js";
import { RestartInstance } from "../../application/automation/instances/restart-instance.js";
import { ResumeInstance } from "../../application/automation/instances/resume-instance.js";
import { StartInstance } from "../../application/automation/instances/start-instance.js";
import { SuspendInstance } from "../../application/automation/instances/suspend-instance.js";
import { CreateSecret } from "../../application/automation/secrets/create-secret.js";
import { DeleteSecret } from "../../application/automation/secrets/delete-secret.js";
import { ReplaceSecret } from "../../application/automation/secrets/replace-secret.js";
import { CreateSubscription } from "../../application/automation/subscriptions/create-subscription.js";
import { DeleteSubscription } from "../../application/automation/subscriptions/delete-subscription.js";
import { SubscriptionQueries } from "../../application/automation/subscriptions/queries.js";
import { CreateWebhook } from "../../application/automation/webhooks/create-webhook.js";
import { DeleteWebhook } from "../../application/automation/webhooks/delete-webhook.js";
import { WebhookRepository } from "../../application/automation/webhooks/ports.js";
import { WebhookQueries } from "../../application/automation/webhooks/queries.js";
import { ReceiveWebhookCall } from "../../application/automation/webhooks/receive-webhook-call.js";
import { ArchiveWorkflow } from "../../application/automation/workflows/archive-workflow.js";
import { CheckDefinition } from "../../application/automation/workflows/check-definition.js";
import { DefinitionCompiler } from "../../application/automation/workflows/ports.js";
import { TurnWorkflowOff } from "../../application/automation/workflows/turn-workflow-off.js";
import { TurnWorkflowOn } from "../../application/automation/workflows/turn-workflow-on.js";
import { AutomationPolicy } from "../../interface-adapters/api/auth/automation.policy.js";
import { DraftsController } from "../../interface-adapters/api/controllers/drafts.controller.js";
import { EventsController } from "../../interface-adapters/api/controllers/events.controller.js";
import { ExpectedStartsController } from "../../interface-adapters/api/controllers/expected-starts.controller.js";
import { HooksController } from "../../interface-adapters/api/controllers/hooks.controller.js";
import { HostController } from "../../interface-adapters/api/controllers/host.controller.js";
import { ImportsController } from "../../interface-adapters/api/controllers/imports.controller.js";
import { InstancesController } from "../../interface-adapters/api/controllers/instances.controller.js";
import { SecretsController } from "../../interface-adapters/api/controllers/secrets.controller.js";
import { SubscriptionsController } from "../../interface-adapters/api/controllers/subscriptions.controller.js";
import { TestRunsController } from "../../interface-adapters/api/controllers/test-runs.controller.js";
import { WebhooksController } from "../../interface-adapters/api/controllers/webhooks.controller.js";
import { WorkflowsController } from "../../interface-adapters/api/controllers/workflows.controller.js";
import { EntityTagMapper } from "../../interface-adapters/api/mappers/entity-tag.mapper.js";
import { SubscriptionEndpointMapper } from "../../interface-adapters/api/mappers/subscription-endpoint.mapper.js";
import { WebhookCallMapper } from "../../interface-adapters/api/mappers/webhook-call.mapper.js";
import { DraftPresenter } from "../../interface-adapters/api/presenters/draft.presenter.js";
import { HostPresenter } from "../../interface-adapters/api/presenters/host.presenter.js";
import { ImportPresenter } from "../../interface-adapters/api/presenters/import.presenter.js";
import { InstancePresenter } from "../../interface-adapters/api/presenters/instance.presenter.js";
import { InstanceReadBack } from "../../interface-adapters/api/read-backs/instance.read-back.js";
import { SecretPresenter } from "../../interface-adapters/api/presenters/secret.presenter.js";
import { SubscriptionPresenter } from "../../interface-adapters/api/presenters/subscription.presenter.js";
import { WebhookPresenter } from "../../interface-adapters/api/presenters/webhook.presenter.js";
import { WorkflowPresenter } from "../../interface-adapters/api/presenters/workflow.presenter.js";
import { DraftMapper } from "../../interface-adapters/persistence/mappers/draft.mapper.js";
import { TaskRecordMapper } from "../../interface-adapters/persistence/mappers/task-record.mapper.js";
import { WebhookMapper } from "../../interface-adapters/persistence/mappers/webhook.mapper.js";
import { PostgresDraftQueries } from "../../interface-adapters/persistence/queries/postgres-draft.queries.js";
import { PostgresEventQueries } from "../../interface-adapters/persistence/queries/postgres-event.queries.js";
import { PostgresInstanceQueries } from "../../interface-adapters/persistence/queries/postgres-instance.queries.js";
import { PostgresSubscriptionQueries } from "../../interface-adapters/persistence/queries/postgres-subscription.queries.js";
import { PostgresWebhookQueries } from "../../interface-adapters/persistence/queries/postgres-webhook.queries.js";
import { PostgresDraftRepository } from "../../interface-adapters/persistence/repositories/postgres-draft.repository.js";
import { PostgresWebhookRepository } from "../../interface-adapters/persistence/repositories/postgres-webhook.repository.js";
import { HttpImportGateway } from "../../interface-adapters/workflows/gateways/http-import.gateway.js";
import { InterpreterCapabilitiesGateway } from "../../interface-adapters/workflows/gateways/interpreter-capabilities.gateway.js";
import { InterpreterCompilerGateway } from "../../interface-adapters/workflows/gateways/interpreter-compiler.gateway.js";
import { StructureClient } from "../../interface-adapters/workflows/interfaces.js";
import { PiscinaInterpreterClient } from "../interpreter/piscina-interpreter.client.js";
import { AutomationModule } from "./automation.module.js";
import { linksConfig } from "./configs.js";
import { hostLimits, processPlatform } from "./host.presets.js";
import { HttpModule } from "./http.module.js";

@Module({
  imports: [AutomationModule, HttpModule, ConfigModule.forFeature(linksConfig)],
  controllers: [
    WorkflowsController,
    ExpectedStartsController,
    DraftsController,
    TestRunsController,
    InstancesController,
    EventsController,
    WebhooksController,
    HooksController,
    HostController,
    ImportsController,
    SecretsController,
    SubscriptionsController,
  ],
  providers: [
    CheckDefinition,
    ArchiveWorkflow,
    TurnWorkflowOn,
    TurnWorkflowOff,
    CreateDraft,
    SaveDraft,
    DraftCompilation,
    PublishDraft,
    TestDraft,
    FetchImport,
    StartInstance,
    RestartInstance,
    SuspendInstance,
    ResumeInstance,
    DeleteInstance,
    AcceptEvent,
    CreateSecret,
    ReplaceSecret,
    DeleteSecret,
    CreateWebhook,
    DeleteWebhook,
    ReceiveWebhookCall,
    CreateSubscription,
    DeleteSubscription,
    AutomationPolicy,
    HttpImportGateway,
    { provide: ImportFetcher, useExisting: HttpImportGateway },
    InterpreterCompilerGateway,
    { provide: DefinitionCompiler, useExisting: InterpreterCompilerGateway },
    InterpreterCapabilitiesGateway,
    { provide: HostCapabilities, useExisting: InterpreterCapabilitiesGateway },
    DraftMapper,
    WebhookMapper,
    TaskRecordMapper,
    { provide: DraftRepository, useClass: PostgresDraftRepository },
    { provide: DraftQueries, useClass: PostgresDraftQueries },
    { provide: InstanceQueries, useClass: PostgresInstanceQueries },
    { provide: EventQueries, useClass: PostgresEventQueries },
    { provide: WebhookRepository, useClass: PostgresWebhookRepository },
    { provide: WebhookQueries, useClass: PostgresWebhookQueries },
    { provide: SubscriptionQueries, useClass: PostgresSubscriptionQueries },
    EntityTagMapper,
    DraftPresenter,
    WorkflowPresenter,
    InstancePresenter,
    InstanceReadBack,
    HostPresenter,
    ImportPresenter,
    SecretPresenter,
    SubscriptionEndpointMapper,
    SubscriptionPresenter,
    {
      provide: WebhookPresenter,
      inject: [linksConfig.KEY],
      useFactory: (links: ConfigType<typeof linksConfig>) =>
        new WebhookPresenter(links.API_BASE_URL),
    },
    WebhookCallMapper,
    { provide: StructureClient, useExisting: PiscinaInterpreterClient },
    { provide: ProcessPlatform, useValue: processPlatform },
    { provide: HostLimits, useValue: hostLimits },
  ],
})
export class AutomationHttpModule {}
