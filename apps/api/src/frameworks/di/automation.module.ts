import { Module } from "@nestjs/common";
import { ConfigModule, type ConfigType } from "@nestjs/config";
import { HttpClientModule } from "@nestjs/http-client";
import { ResilienceService } from "@nestjs/resilience";
import { EventStore } from "../../application/automation/events/ports.js";
import { CancelInstance } from "../../application/automation/instances/cancel-instance.js";
import {
  InstanceEvents,
  InstanceRuns,
  WorkflowInstanceRepository,
  WorkflowRuntime,
} from "../../application/automation/instances/ports.js";
import { ScheduleQueries } from "../../application/automation/schedules/queries.js";
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
import { EventDeliveryGateway } from "../../interface-adapters/messaging/event-delivery.gateway.js";
import { HttpDeliveryGateway } from "../../interface-adapters/messaging/http-delivery.gateway.js";
import { InstanceMessagesGateway } from "../../interface-adapters/messaging/instance-messages.gateway.js";
import { WorkflowMessagesGateway } from "../../interface-adapters/messaging/workflow-messages.gateway.js";
import {
  DeliveryAdmission,
  EventDeliveries,
} from "../../interface-adapters/messaging/interfaces.js";
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
import { ExpectedStartsQueries } from "../../interface-adapters/workflows/queries/expected-starts.queries.js";
import { InterpreterFilterGateway } from "../../interface-adapters/workflows/gateways/interpreter-filter.gateway.js";
import { InterpreterRuntimeGateway } from "../../interface-adapters/workflows/gateways/interpreter-runtime.gateway.js";
import { AccessTokens } from "../../interface-adapters/workflows/effects/access-tokens.js";
import { Authenticator } from "../../interface-adapters/workflows/effects/authenticator.js";
import { HttpGateway } from "../../interface-adapters/workflows/effects/http.gateway.js";
import {
  AuthorizationServer,
  HttpConnection,
} from "../../interface-adapters/workflows/effects/interfaces.js";
import { ResourceGateway } from "../../interface-adapters/workflows/effects/resource.gateway.js";
import { ResponseContent } from "../../interface-adapters/workflows/effects/response-content.js";
import { TransportFailures } from "../../interface-adapters/workflows/effects/transport-failures.js";
import {
  InterpreterClient,
  ResourceClient,
} from "../../interface-adapters/workflows/interfaces.js";
import { DefinitionMapper } from "../../interface-adapters/workflows/mappers/definition.mapper.js";
import { ProtocolMapper } from "../../interface-adapters/workflows/mappers/protocol.mapper.js";
import { RunTurnMapper } from "../../interface-adapters/workflows/mappers/run-turn.mapper.js";
import { ProgramCalls } from "../../interface-adapters/workflows/program-calls.js";
import { AesGcmCipher } from "../crypto/aes-gcm.cipher.js";
import { HOST_PROFILE } from "../interpreter/host-profile.js";
import { PiscinaInterpreterClient } from "../interpreter/piscina-interpreter.client.js";
import { AddressPolicy } from "../network/address-policy.js";
import { HttpClientName } from "../network/enums.js";
import { OutboundHttpConnection } from "../network/outbound.http-connection.js";
import { ResponseSizeLimit } from "../network/response-size-limit.js";
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
    InstanceMessagesGateway,
    { provide: InstanceEvents, useExisting: InstanceMessagesGateway },
    { provide: InstanceRuns, useExisting: InstanceMessagesGateway },
    WorkflowMessagesGateway,
    { provide: WorkflowEvents, useExisting: WorkflowMessagesGateway },
    { provide: ScheduleQueries, useClass: ExpectedStartsQueries },
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
      ) =>
        new PiscinaInterpreterClient(
          resilience,
          { legacyEventTypes: interpreter.LEGACY_EVENT_TYPES },
          {
            runs: interpreter.INTERPRETER_RUN_THREADS,
            checks: interpreter.INTERPRETER_CHECK_THREADS,
          },
        ),
    },
    { provide: InterpreterClient, useExisting: PiscinaInterpreterClient },
    { provide: AuthorizationServer, useClass: OpenIdAuthorizationServer },
    AccessTokens,
    {
      provide: Authenticator,
      inject: [AccessTokens],
      useFactory: (tokens: AccessTokens) =>
        new Authenticator(tokens, HOST_PROFILE),
    },
    { provide: HttpConnection, useClass: OutboundHttpConnection },
    TransportFailures,
    ResponseContent,
    HttpGateway,
    ResourceGateway,
    { provide: ResourceClient, useExisting: ResourceGateway },
    { provide: DeliveryAdmission, useExisting: AddressPolicy },
    HttpDeliveryGateway,
    { provide: EventDeliveries, useExisting: HttpDeliveryGateway },
    EventDeliveryGateway,
    { provide: EventSender, useExisting: EventDeliveryGateway },
  ],
  exports: [
    CancelInstance,
    ProtocolMapper,
    ProgramCalls,
    DefinitionMapper,
    WorkflowRuntime,
    SubscriptionFilters,
    InstanceEvents,
    InstanceRuns,
    WorkflowEvents,
    ScheduleQueries,
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
    TransportFailures,
    ResponseContent,
    HttpGateway,
    ResourceGateway,
    ResourceClient,
    EventSender,
  ],
})
export class AutomationModule {}
