import { Module } from "@nestjs/common";
import { ConfigModule, type ConfigType } from "@nestjs/config";
import { HttpClientModule } from "@nestjs/http-client";
import { ResilienceService } from "@nestjs/resilience";
import {
  EventAnnouncements,
  EventOffers,
  EventStore,
} from "../../application/automation/events/ports.js";
import { CancelInstance } from "../../application/automation/instances/cancel-instance.js";
import { InstanceEvents } from "../../application/automation/instances/instance-events.js";
import {
  ChildCancellations,
  InstanceMessages,
  InstanceRuns,
  LifecycleEvents,
  WorkflowInstanceRepository,
  WorkflowRuntime,
} from "../../application/automation/instances/ports.js";
import { SecretRepository } from "../../application/automation/secrets/ports.js";
import { SecretQueries } from "../../application/automation/secrets/queries.js";
import {
  EventSender,
  SubscriptionFilters,
  SubscriptionRepository,
} from "../../application/automation/subscriptions/ports.js";
import {
  WorkflowEvents,
  WorkflowRepository,
} from "../../application/automation/workflows/ports.js";
import { WorkflowQueries } from "../../application/automation/workflows/queries.js";
import { Authenticator } from "../../interface-adapters/auth/authenticator.js";
import { AccessTokens } from "../../interface-adapters/auth/interfaces.js";
import { HttpCallGateway } from "../../interface-adapters/http/http-call.gateway.js";
import { HttpClient } from "../../interface-adapters/http/interfaces.js";
import { ResourceGateway } from "../../interface-adapters/http/resource.gateway.js";
import { SubscriberDeliveryGateway } from "../../interface-adapters/http/subscriber-delivery.gateway.js";
import { EventMessagesGateway } from "../../interface-adapters/messaging/event-messages.gateway.js";
import { InstanceMessagesGateway } from "../../interface-adapters/messaging/instance-messages.gateway.js";
import { RunDataMapper } from "../../interface-adapters/messaging/mappers/run-data.mapper.js";
import { WorkflowMessagesGateway } from "../../interface-adapters/messaging/workflow-messages.gateway.js";
import { Cipher } from "../../interface-adapters/persistence/interfaces.js";
import { LifecycleEventMapper } from "../../interface-adapters/persistence/mappers/lifecycle-event.mapper.js";
import { SecretMapper } from "../../interface-adapters/persistence/mappers/secret.mapper.js";
import { SubscriptionMapper } from "../../interface-adapters/persistence/mappers/subscription.mapper.js";
import { TaskValueMapper } from "../../interface-adapters/persistence/mappers/task-value.mapper.js";
import { WebhookEventMapper } from "../../interface-adapters/persistence/mappers/webhook-event.mapper.js";
import { WorkflowInstanceMapper } from "../../interface-adapters/persistence/mappers/workflow-instance.mapper.js";
import { WorkflowMapper } from "../../interface-adapters/persistence/mappers/workflow.mapper.js";
import { WorkflowVersionMapper } from "../../interface-adapters/persistence/mappers/workflow-version.mapper.js";
import { PostgresSecretQueries } from "../../interface-adapters/persistence/queries/postgres-secret.queries.js";
import { PostgresWorkflowQueries } from "../../interface-adapters/persistence/queries/postgres-workflow.queries.js";
import { PostgresSecretRepository } from "../../interface-adapters/persistence/repositories/postgres-secret.repository.js";
import { PostgresSubscriptionRepository } from "../../interface-adapters/persistence/repositories/postgres-subscription.repository.js";
import { PostgresWorkflowInstanceRepository } from "../../interface-adapters/persistence/repositories/postgres-workflow-instance.repository.js";
import { PostgresWorkflowRepository } from "../../interface-adapters/persistence/repositories/postgres-workflow.repository.js";
import { PostgresEventStore } from "../../interface-adapters/persistence/stores/postgres-event.store.js";
import { PostgresLifecycleEventStore } from "../../interface-adapters/persistence/stores/postgres-lifecycle-event.store.js";
import { PostgresTaskValueStore } from "../../interface-adapters/persistence/stores/postgres-task-value.store.js";
import { InterpreterFilterGateway } from "../../interface-adapters/workflows/gateways/interpreter-filter.gateway.js";
import { InterpreterRuntimeGateway } from "../../interface-adapters/workflows/gateways/interpreter-runtime.gateway.js";
import { InterpreterClient } from "../../interface-adapters/workflows/interfaces.js";
import { DefinitionMapper } from "../../interface-adapters/workflows/mappers/definition.mapper.js";
import { ProtocolMapper } from "../../interface-adapters/workflows/mappers/protocol.mapper.js";
import { RunTurnMapper } from "../../interface-adapters/workflows/mappers/run-turn.mapper.js";
import { ProgramCalls } from "../../interface-adapters/workflows/program-calls.js";
import { AesGcmCipher } from "../crypto/aes-gcm.cipher.js";
import { HOST_PROFILE } from "../interpreter/host-profile.js";
import { PiscinaInterpreterClient } from "../interpreter/piscina-interpreter.client.js";
import { AddressPolicy } from "../http/address-policy.js";
import { HttpClientName } from "../http/enums.js";
import { OutboundHttpClient } from "../http/outbound.http-client.js";
import { ResponseContent } from "../http/response-content.js";
import { ResponseSizeLimit } from "../http/response-size-limit.js";
import { TransportFaults } from "../http/transport-faults.js";
import { OpenIdAccessTokens } from "../oauth/openid.access-tokens.js";
import { OpenIdAuthorizationServer } from "../oauth/openid.authorization-server.js";
import { interpreterConfig, linksConfig, secretsConfig } from "./configs.js";
import { OutboundModule } from "./outbound.module.js";

@Module({
  imports: [
    ConfigModule.forFeature(secretsConfig),
    ConfigModule.forFeature(linksConfig),
    ConfigModule.forFeature(interpreterConfig),
    OutboundModule,
    HttpClientModule.registerAsync({
      name: HttpClientName.Outbound,
      imports: [OutboundModule],
      interceptors: [ResponseSizeLimit],
      inject: [AddressPolicy],
      useFactory: (policy: AddressPolicy) => ({
        dispatcher: policy.dispatcher,
      }),
    }),
  ],
  providers: [
    CancelInstance,
    ProtocolMapper,
    ProgramCalls,
    RunTurnMapper,
    DefinitionMapper,
    InterpreterRuntimeGateway,
    { provide: WorkflowRuntime, useExisting: InterpreterRuntimeGateway },
    InterpreterFilterGateway,
    { provide: SubscriptionFilters, useExisting: InterpreterFilterGateway },
    RunDataMapper,
    InstanceEvents,
    InstanceMessagesGateway,
    { provide: InstanceMessages, useExisting: InstanceMessagesGateway },
    { provide: InstanceRuns, useExisting: InstanceMessagesGateway },
    { provide: ChildCancellations, useExisting: InstanceMessagesGateway },
    EventMessagesGateway,
    { provide: EventAnnouncements, useExisting: EventMessagesGateway },
    { provide: EventOffers, useExisting: EventMessagesGateway },
    WorkflowMessagesGateway,
    { provide: WorkflowEvents, useExisting: WorkflowMessagesGateway },
    WorkflowMapper,
    WorkflowVersionMapper,
    WorkflowInstanceMapper,
    {
      provide: LifecycleEventMapper,
      inject: [linksConfig.KEY],
      useFactory: (links: ConfigType<typeof linksConfig>) =>
        new LifecycleEventMapper(links.API_BASE_URL),
    },
    TaskValueMapper,
    WebhookEventMapper,
    SecretMapper,
    SubscriptionMapper,
    { provide: WorkflowRepository, useClass: PostgresWorkflowRepository },
    { provide: WorkflowQueries, useClass: PostgresWorkflowQueries },
    {
      provide: WorkflowInstanceRepository,
      useClass: PostgresWorkflowInstanceRepository,
    },
    PostgresLifecycleEventStore,
    { provide: LifecycleEvents, useExisting: PostgresLifecycleEventStore },
    PostgresTaskValueStore,
    PostgresEventStore,
    { provide: EventStore, useExisting: PostgresEventStore },
    { provide: SecretRepository, useClass: PostgresSecretRepository },
    { provide: SecretQueries, useClass: PostgresSecretQueries },
    {
      provide: SubscriptionRepository,
      useClass: PostgresSubscriptionRepository,
    },
    {
      provide: Cipher,
      inject: [secretsConfig.KEY],
      useFactory: (secrets: ConfigType<typeof secretsConfig>) =>
        new AesGcmCipher(secrets.SECRETS_KEY),
    },
    {
      provide: PiscinaInterpreterClient,
      inject: [ResilienceService, interpreterConfig.KEY],
      useFactory: (
        resilience: ResilienceService,
        interpreter: ConfigType<typeof interpreterConfig>,
      ) => {
        const options = { legacyEventTypes: interpreter.LEGACY_EVENT_TYPES };
        const threads = {
          runs: interpreter.INTERPRETER_RUN_THREADS,
          checks: interpreter.INTERPRETER_CHECK_THREADS,
        };
        return new PiscinaInterpreterClient(resilience, options, threads);
      },
    },
    { provide: InterpreterClient, useExisting: PiscinaInterpreterClient },
    TransportFaults,
    ResponseContent,
    OutboundHttpClient,
    { provide: HttpClient, useExisting: OutboundHttpClient },
    OpenIdAuthorizationServer,
    { provide: AccessTokens, useClass: OpenIdAccessTokens },
    {
      provide: Authenticator,
      inject: [AccessTokens],
      useFactory: (tokens: AccessTokens) =>
        new Authenticator(tokens, HOST_PROFILE),
    },
    HttpCallGateway,
    ResourceGateway,
    SubscriberDeliveryGateway,
    { provide: EventSender, useExisting: SubscriberDeliveryGateway },
  ],
  exports: [
    CancelInstance,
    ProtocolMapper,
    ProgramCalls,
    DefinitionMapper,
    WorkflowRuntime,
    SubscriptionFilters,
    RunDataMapper,
    InstanceEvents,
    InstanceRuns,
    ChildCancellations,
    EventOffers,
    WorkflowEvents,
    WorkflowRepository,
    WorkflowQueries,
    WorkflowInstanceRepository,
    WorkflowInstanceMapper,
    TaskValueMapper,
    EventStore,
    SecretRepository,
    SecretQueries,
    SubscriptionRepository,
    Cipher,
    PiscinaInterpreterClient,
    InterpreterClient,
    Authenticator,
    TransportFaults,
    ResponseContent,
    OutboundHttpClient,
    HttpCallGateway,
    ResourceGateway,
    EventSender,
  ],
})
export class AutomationModule {}
