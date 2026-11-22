import { Module, type Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  getHttpClientToken,
  HttpClientModule,
  type HttpClient as NestHttpClient,
} from "@nestjs/http-client";
import { ResilienceService } from "@nestjs/resilience";
import { CreateDraft } from "../../application/automation/drafts/create-draft.js";
import { DraftRepository } from "../../application/automation/drafts/ports.js";
import { PublishDraft } from "../../application/automation/drafts/publish-draft.js";
import { DraftQueries } from "../../application/automation/drafts/queries.js";
import { SaveDraft } from "../../application/automation/drafts/save-draft.js";
import { AcceptEvent } from "../../application/automation/events/accept-event.js";
import { FetchImport } from "../../application/automation/imports/fetch-import.js";
import { ImportFetcher } from "../../application/automation/imports/ports.js";
import {
  HostCapabilities,
  HostLimits,
  ProcessPlatform,
} from "../../application/automation/host/queries.js";
import { DispatchEvent } from "../../application/automation/events/dispatch-event.js";
import { EmitEvent } from "../../application/automation/events/emit-event.js";
import {
  EventOffers,
  EventRouting,
  EventStore,
} from "../../application/automation/events/ports.js";
import { EventQueries } from "../../application/automation/events/queries.js";
import { AnswerParent } from "../../application/automation/instances/answer-parent.js";
import { AnswerReceives } from "../../application/automation/instances/answer-receives.js";
import { BeginRun } from "../../application/automation/instances/begin-run.js";
import { CancelChildren } from "../../application/automation/instances/cancel-children.js";
import { CancelInstance } from "../../application/automation/instances/cancel-instance.js";
import { CancelStrandedRun } from "../../application/automation/instances/cancel-stranded-run.js";
import { DeleteInstance } from "../../application/automation/instances/delete-instance.js";
import { FailRun } from "../../application/automation/instances/fail-run.js";
import { OfferEvent } from "../../application/automation/instances/offer-event.js";
import {
  ChildCancellations,
  InstanceRuns,
  ReceivedMessages,
  WorkflowInstanceRepository,
  WorkflowRuntime,
} from "../../application/automation/instances/ports.js";
import {
  InstanceQueries,
  ReceiverQueries,
} from "../../application/automation/instances/queries.js";
import { ReceiveInbound } from "../../application/automation/instances/receive-inbound.js";
import { RespondToEffect } from "../../application/automation/instances/respond-to-effect.js";
import { RestartInstance } from "../../application/automation/instances/restart-instance.js";
import { ResumeInstance } from "../../application/automation/instances/resume-instance.js";
import { StartInstance } from "../../application/automation/instances/start-instance.js";
import { StartSubWorkflow } from "../../application/automation/instances/start-sub-workflow.js";
import { SuspendInstance } from "../../application/automation/instances/suspend-instance.js";
import { ContinueSchedule } from "../../application/automation/schedules/continue-schedule.js";
import { WorkflowSchedules } from "../../application/automation/schedules/ports.js";
import { StartOnEvent } from "../../application/automation/schedules/start-on-event.js";
import { StartScheduledInstance } from "../../application/automation/schedules/start-scheduled-instance.js";
import { SyncSchedule } from "../../application/automation/schedules/sync-schedule.js";
import { CreateSecret } from "../../application/automation/secrets/create-secret.js";
import { DeleteSecret } from "../../application/automation/secrets/delete-secret.js";
import { SecretRepository } from "../../application/automation/secrets/ports.js";
import { SecretQueries } from "../../application/automation/secrets/queries.js";
import { ReplaceSecret } from "../../application/automation/secrets/replace-secret.js";
import { CreateSubscription } from "../../application/automation/subscriptions/create-subscription.js";
import { DeleteSubscription } from "../../application/automation/subscriptions/delete-subscription.js";
import { DeliverEvent } from "../../application/automation/subscriptions/deliver-event.js";
import { FailDelivery } from "../../application/automation/subscriptions/fail-delivery.js";
import { MatchSubscriptions } from "../../application/automation/subscriptions/match-subscriptions.js";
import {
  Deliveries,
  DeliveryLog,
  EventSender,
  SubscriptionFilters,
  SubscriptionRepository,
} from "../../application/automation/subscriptions/ports.js";
import { SubscriptionQueries } from "../../application/automation/subscriptions/queries.js";
import { CreateWebhook } from "../../application/automation/webhooks/create-webhook.js";
import { DeleteWebhook } from "../../application/automation/webhooks/delete-webhook.js";
import { WebhookRepository } from "../../application/automation/webhooks/ports.js";
import { WebhookQueries } from "../../application/automation/webhooks/queries.js";
import { ReceiveWebhookCall } from "../../application/automation/webhooks/receive-webhook-call.js";
import { ArchiveWorkflow } from "../../application/automation/workflows/archive-workflow.js";
import { CheckDefinition } from "../../application/automation/workflows/check-definition.js";
import {
  DefinitionCompiler,
  WorkflowRepository,
} from "../../application/automation/workflows/ports.js";
import { WorkflowQueries } from "../../application/automation/workflows/queries.js";
import { TurnWorkflowOff } from "../../application/automation/workflows/turn-workflow-off.js";
import { TurnWorkflowOn } from "../../application/automation/workflows/turn-workflow-on.js";
import { DraftsController } from "../../interface-adapters/api/controllers/drafts.controller.js";
import { EventsController } from "../../interface-adapters/api/controllers/events.controller.js";
import { HooksController } from "../../interface-adapters/api/controllers/hooks.controller.js";
import { HostController } from "../../interface-adapters/api/controllers/host.controller.js";
import { ImportsController } from "../../interface-adapters/api/controllers/imports.controller.js";
import { InstancesController } from "../../interface-adapters/api/controllers/instances.controller.js";
import { SecretsController } from "../../interface-adapters/api/controllers/secrets.controller.js";
import { SubscriptionsController } from "../../interface-adapters/api/controllers/subscriptions.controller.js";
import { WebhooksController } from "../../interface-adapters/api/controllers/webhooks.controller.js";
import { WorkflowsController } from "../../interface-adapters/api/controllers/workflows.controller.js";
import { EntityTagMapper } from "../../interface-adapters/api/mappers/entity-tag.mapper.js";
import { SubscriptionEndpointMapper } from "../../interface-adapters/api/mappers/subscription-endpoint.mapper.js";
import { WebhookCallMapper } from "../../interface-adapters/api/mappers/webhook-call.mapper.js";
import { DraftPresenter } from "../../interface-adapters/api/presenters/draft.presenter.js";
import { HostPresenter } from "../../interface-adapters/api/presenters/host.presenter.js";
import { ImportPresenter } from "../../interface-adapters/api/presenters/import.presenter.js";
import { InstancePresenter } from "../../interface-adapters/api/presenters/instance.presenter.js";
import { ProblemPresenter } from "../../interface-adapters/api/presenters/problem.presenter.js";
import { SecretPresenter } from "../../interface-adapters/api/presenters/secret.presenter.js";
import { SubscriptionPresenter } from "../../interface-adapters/api/presenters/subscription.presenter.js";
import { WebhookPresenter } from "../../interface-adapters/api/presenters/webhook.presenter.js";
import { WorkflowPresenter } from "../../interface-adapters/api/presenters/workflow.presenter.js";
import { DraftMapper } from "../../interface-adapters/persistence/mappers/draft.mapper.js";
import { InboundMapper } from "../../interface-adapters/persistence/mappers/inbound.mapper.js";
import { LifecycleEventMapper } from "../../interface-adapters/persistence/mappers/lifecycle-event.mapper.js";
import { SecretMapper } from "../../interface-adapters/persistence/mappers/secret.mapper.js";
import { SubscriptionMapper } from "../../interface-adapters/persistence/mappers/subscription.mapper.js";
import { TaskRecordMapper } from "../../interface-adapters/persistence/mappers/task-record.mapper.js";
import { TaskValueMapper } from "../../interface-adapters/persistence/mappers/task-value.mapper.js";
import { WebhookEventMapper } from "../../interface-adapters/persistence/mappers/webhook-event.mapper.js";
import { WebhookMapper } from "../../interface-adapters/persistence/mappers/webhook.mapper.js";
import { WorkflowInstanceMapper } from "../../interface-adapters/persistence/mappers/workflow-instance.mapper.js";
import { WorkflowMapper } from "../../interface-adapters/persistence/mappers/workflow.mapper.js";
import { WorkflowVersionMapper } from "../../interface-adapters/persistence/mappers/workflow-version.mapper.js";
import { PostgresDraftQueries } from "../../interface-adapters/persistence/queries/postgres-draft.queries.js";
import { PostgresEventQueries } from "../../interface-adapters/persistence/queries/postgres-event.queries.js";
import { PostgresInstanceQueries } from "../../interface-adapters/persistence/queries/postgres-instance.queries.js";
import { PostgresReceiverQueries } from "../../interface-adapters/persistence/queries/postgres-receiver.queries.js";
import { PostgresSecretQueries } from "../../interface-adapters/persistence/queries/postgres-secret.queries.js";
import { PostgresSubscriptionQueries } from "../../interface-adapters/persistence/queries/postgres-subscription.queries.js";
import { PostgresWebhookQueries } from "../../interface-adapters/persistence/queries/postgres-webhook.queries.js";
import { PostgresWorkflowQueries } from "../../interface-adapters/persistence/queries/postgres-workflow.queries.js";
import { PostgresDraftRepository } from "../../interface-adapters/persistence/repositories/postgres-draft.repository.js";
import { PostgresSecretRepository } from "../../interface-adapters/persistence/repositories/postgres-secret.repository.js";
import { PostgresSubscriptionRepository } from "../../interface-adapters/persistence/repositories/postgres-subscription.repository.js";
import { PostgresWebhookRepository } from "../../interface-adapters/persistence/repositories/postgres-webhook.repository.js";
import { PostgresWorkflowInstanceRepository } from "../../interface-adapters/persistence/repositories/postgres-workflow-instance.repository.js";
import { PostgresWorkflowRepository } from "../../interface-adapters/persistence/repositories/postgres-workflow.repository.js";
import { PostgresChildCancellationStore } from "../../interface-adapters/persistence/stores/postgres-child-cancellation.store.js";
import { PostgresDeliveryLogStore } from "../../interface-adapters/persistence/stores/postgres-delivery-log.store.js";
import { PostgresEventOfferStore } from "../../interface-adapters/persistence/stores/postgres-event-offer.store.js";
import { PostgresEventStore } from "../../interface-adapters/persistence/stores/postgres-event.store.js";
import { PostgresLifecycleEventStore } from "../../interface-adapters/persistence/stores/postgres-lifecycle-event.store.js";
import { PostgresReceivedMessageStore } from "../../interface-adapters/persistence/stores/postgres-received-message.store.js";
import { PostgresTaskValueStore } from "../../interface-adapters/persistence/stores/postgres-task-value.store.js";
import {
  InterpreterClient,
  StructureClient,
} from "../../interface-adapters/workflows/ports.js";
import { InterpreterGateway } from "../../interface-adapters/workflows/interpreter.gateway.js";
import { RunController } from "../../interface-adapters/workflows/run.controller.js";
import { WorkerInterpreterClient } from "../interpreter/worker-interpreter.client.js";
import { DeliveryRun } from "../workflows/delivery.run.js";
import { EffectPerformer } from "../workflows/effect-performer.js";
import { EngineDeliveryClient } from "../workflows/engine-delivery.client.js";
import { EngineRunClient } from "../workflows/engine-run.client.js";
import { EngineScheduleClient } from "../workflows/engine-schedule.client.js";
import { AutomationHandler } from "../../interface-adapters/messaging/automation.handler.js";
import { OpenWorkflowRun } from "../workflows/open-workflow.run.js";
import { ProcessRun } from "../workflows/process.run.js";
import { ScheduleRun } from "../workflows/schedule.run.js";
import { StartUpJobs } from "../schedule/start-up.jobs.js";
import { Cipher } from "../../interface-adapters/persistence/ports.js";
import { A2aClient } from "../a2a/a2a.client.js";
import { AmqpBroker } from "../asyncapi/amqp.broker.js";
import { AsyncApiClient } from "../asyncapi/asyncapi.client.js";
import { AsyncApiDocuments } from "../asyncapi/asyncapi-documents.js";
import { AsyncApiReceivers } from "../asyncapi/asyncapi-receivers.js";
import { KafkaBroker } from "../asyncapi/kafka.broker.js";
import { MqttBroker } from "../asyncapi/mqtt.broker.js";
import { NatsBroker } from "../asyncapi/nats.broker.js";
import { RedisBroker } from "../asyncapi/redis.broker.js";
import { AesGcmCipher } from "../crypto/aes-gcm.cipher.js";
import { SandboxClient } from "../go-judge/sandbox.client.js";
import { SandboxLimits } from "../go-judge/sandbox-limits.js";
import { GrpcClient } from "../grpc/grpc.client.js";
import { ProtoSchema } from "../grpc/proto-schema.js";
import { AddressPolicy } from "../http-client/address-policy.js";
import { AuthorizationServer } from "../http-client/authorization-server.js";
import { DeliveryClient } from "../http-client/delivery.client.js";
import { DigestAuthentication } from "../http-client/digest-authentication.js";
import { HttpClientName } from "../http-client/enums.js";
import { HttpAuthentication } from "../http-client/http-authentication.js";
import { HttpClient } from "../http-client/http.client.js";
import { OpenApiOperations } from "../http-client/openapi-operations.js";
import { ResponseSizeLimit } from "../http-client/response-size-limit.js";
import { McpClient } from "../mcp/mcp.client.js";
import type { Env } from "./env.schema.js";
import { OutboundModule } from "./outbound.module.js";
import { hostLimits } from "./resilience.presets.js";

const sandboxLimits = new SandboxLimits({
  time: Temporal.Duration.from({ seconds: 30 }),
  memoryBytes: 256 * 1024 * 1024,
  processes: 50,
  outputBytes: 1024 * 1024,
});

const ports: Provider[] = [
  WorkerInterpreterClient,
  { provide: InterpreterClient, useExisting: WorkerInterpreterClient },
  { provide: StructureClient, useExisting: WorkerInterpreterClient },
  InterpreterGateway,
  { provide: HostCapabilities, useExisting: InterpreterGateway },
  { provide: HostLimits, useValue: hostLimits },
  { provide: ProcessPlatform, useExisting: SandboxClient },
  { provide: DefinitionCompiler, useExisting: InterpreterGateway },
  { provide: WorkflowRuntime, useExisting: InterpreterGateway },
  { provide: EventRouting, useExisting: InterpreterGateway },
  { provide: SubscriptionFilters, useExisting: InterpreterGateway },
  EngineRunClient,
  { provide: InstanceRuns, useExisting: EngineRunClient },
  EngineScheduleClient,
  { provide: WorkflowSchedules, useExisting: EngineScheduleClient },
  EngineDeliveryClient,
  { provide: Deliveries, useExisting: EngineDeliveryClient },
  { provide: EventSender, useExisting: DeliveryClient },
  { provide: ImportFetcher, useExisting: HttpClient },
];

const persistence: Provider[] = [
  WorkflowMapper,
  WorkflowVersionMapper,
  DraftMapper,
  WorkflowInstanceMapper,
  {
    provide: LifecycleEventMapper,
    inject: [ConfigService],
    useFactory: (config: ConfigService<Env, true>) =>
      new LifecycleEventMapper(config.get("API_BASE_URL", { infer: true })),
  },
  TaskRecordMapper,
  TaskValueMapper,
  InboundMapper,
  WebhookEventMapper,
  SecretMapper,
  WebhookMapper,
  SubscriptionMapper,
  { provide: WorkflowRepository, useClass: PostgresWorkflowRepository },
  { provide: WorkflowQueries, useClass: PostgresWorkflowQueries },
  { provide: DraftRepository, useClass: PostgresDraftRepository },
  { provide: DraftQueries, useClass: PostgresDraftQueries },
  {
    provide: WorkflowInstanceRepository,
    useClass: PostgresWorkflowInstanceRepository,
  },
  { provide: InstanceQueries, useClass: PostgresInstanceQueries },
  PostgresLifecycleEventStore,
  PostgresTaskValueStore,
  PostgresEventStore,
  { provide: EventStore, useExisting: PostgresEventStore },
  { provide: EventQueries, useClass: PostgresEventQueries },
  { provide: EventOffers, useClass: PostgresEventOfferStore },
  { provide: SecretRepository, useClass: PostgresSecretRepository },
  { provide: SecretQueries, useClass: PostgresSecretQueries },
  { provide: WebhookRepository, useClass: PostgresWebhookRepository },
  { provide: WebhookQueries, useClass: PostgresWebhookQueries },
  { provide: SubscriptionRepository, useClass: PostgresSubscriptionRepository },
  { provide: SubscriptionQueries, useClass: PostgresSubscriptionQueries },
  { provide: DeliveryLog, useClass: PostgresDeliveryLogStore },
  { provide: ChildCancellations, useClass: PostgresChildCancellationStore },
  { provide: ReceivedMessages, useClass: PostgresReceivedMessageStore },
  { provide: ReceiverQueries, useClass: PostgresReceiverQueries },
];

const useCases: Provider[] = [
  CheckDefinition,
  ArchiveWorkflow,
  TurnWorkflowOn,
  TurnWorkflowOff,
  CreateDraft,
  SaveDraft,
  PublishDraft,
  FetchImport,
  SyncSchedule,
  StartInstance,
  RestartInstance,
  StartScheduledInstance,
  StartOnEvent,
  StartSubWorkflow,
  BeginRun,
  RespondToEffect,
  OfferEvent,
  AnswerParent,
  ReceiveInbound,
  AnswerReceives,
  SuspendInstance,
  ResumeInstance,
  CancelInstance,
  CancelChildren,
  CancelStrandedRun,
  DeleteInstance,
  FailRun,
  ContinueSchedule,
  AcceptEvent,
  EmitEvent,
  DispatchEvent,
  CreateSecret,
  ReplaceSecret,
  DeleteSecret,
  CreateWebhook,
  DeleteWebhook,
  ReceiveWebhookCall,
  CreateSubscription,
  DeleteSubscription,
  MatchSubscriptions,
  DeliverEvent,
  FailDelivery,
];

const engine: Provider[] = [
  RunController,
  EffectPerformer,
  OpenWorkflowRun,
  ProcessRun,
  ScheduleRun,
  DeliveryRun,
  AutomationHandler,
  StartUpJobs,
  AsyncApiReceivers,
];

const clients: Provider[] = [
  {
    provide: Cipher,
    inject: [ConfigService],
    useFactory: (config: ConfigService<Env, true>) =>
      new AesGcmCipher(config.get("SECRETS_KEY", { infer: true })),
  },
  AuthorizationServer,
  HttpAuthentication,
  DigestAuthentication,
  OpenApiOperations,
  HttpClient,
  DeliveryClient,
  ProtoSchema,
  GrpcClient,
  McpClient,
  A2aClient,
  AsyncApiDocuments,
  AmqpBroker,
  KafkaBroker,
  MqttBroker,
  NatsBroker,
  RedisBroker,
  AsyncApiClient,
  {
    provide: SandboxClient,
    inject: [
      getHttpClientToken(HttpClientName.Sandbox),
      HttpClient,
      ResilienceService,
    ],
    useFactory: (
      sandbox: NestHttpClient,
      http: HttpClient,
      resilience: ResilienceService,
    ) => new SandboxClient(sandbox, http, sandboxLimits, resilience),
  },
];

const presenters: Provider[] = [
  ProblemPresenter,
  EntityTagMapper,
  DraftPresenter,
  WorkflowPresenter,
  InstancePresenter,
  HostPresenter,
  ImportPresenter,
  SecretPresenter,
  SubscriptionEndpointMapper,
  SubscriptionPresenter,
  {
    provide: WebhookPresenter,
    inject: [ConfigService],
    useFactory: (config: ConfigService<Env, true>) =>
      new WebhookPresenter(config.get("API_BASE_URL", { infer: true })),
  },
  WebhookCallMapper,
];

const outbound = [
  OutboundModule,
  HttpClientModule.registerAsync({
    name: HttpClientName.Effects,
    imports: [OutboundModule],
    inject: [AddressPolicy],
    useFactory: (policy: AddressPolicy) => ({
      dispatcher: policy.dispatcher,
      interceptors: [new ResponseSizeLimit(HttpClient.RESPONSE_BYTES)],
    }),
  }),
  HttpClientModule.registerAsync({
    name: HttpClientName.IdentityProvider,
    imports: [OutboundModule],
    inject: [AddressPolicy],
    useFactory: (policy: AddressPolicy) => ({
      dispatcher: policy.dispatcher,
      interceptors: [new ResponseSizeLimit(HttpClient.RESPONSE_BYTES)],
    }),
  }),
  HttpClientModule.registerAsync({
    name: HttpClientName.Deliveries,
    imports: [OutboundModule],
    inject: [AddressPolicy],
    useFactory: (policy: AddressPolicy) => ({
      dispatcher: policy.dispatcher,
      interceptors: [new ResponseSizeLimit(HttpClient.RESPONSE_BYTES)],
    }),
  }),
  HttpClientModule.registerAsync({
    name: HttpClientName.Sandbox,
    inject: [ConfigService],
    useFactory: (config: ConfigService<Env, true>) => ({
      baseUrl: config.get("SANDBOX_URL", { infer: true }),
      headers: {
        authorization: `Bearer ${config.get("SANDBOX_TOKEN", { infer: true })}`,
      },
      interceptors: [new ResponseSizeLimit(sandboxLimits.responseBytes())],
    }),
  }),
];

@Module({
  imports: outbound,
  controllers: [
    WorkflowsController,
    DraftsController,
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
    ...clients,
    ...ports,
    ...persistence,
    ...useCases,
    ...engine,
    ...presenters,
  ],
})
export class AutomationModule {}
