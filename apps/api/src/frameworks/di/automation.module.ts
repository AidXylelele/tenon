import { Module } from "@nestjs/common";
import { ConfigModule, type ConfigType } from "@nestjs/config";
import { HttpClientModule } from "@nestjs/http-client";
import { EventStore } from "../../application/automation/events/ports.js";
import { CancelInstance } from "../../application/automation/instances/cancel-instance.js";
import {
  InstanceRuns,
  WorkflowInstanceRepository,
  WorkflowRuntime,
} from "../../application/automation/instances/ports.js";
import { InstanceQueries } from "../../application/automation/instances/queries.js";
import { WorkflowSchedules } from "../../application/automation/schedules/ports.js";
import { SecretRepository } from "../../application/automation/secrets/ports.js";
import { SecretQueries } from "../../application/automation/secrets/queries.js";
import {
  EventSender,
  SubscriptionFilters,
  SubscriptionRepository,
} from "../../application/automation/subscriptions/ports.js";
import { WorkflowRepository } from "../../application/automation/workflows/ports.js";
import { WorkflowQueries } from "../../application/automation/workflows/queries.js";
import { EventDeliveryGateway } from "../../interface-adapters/messaging/event-delivery.gateway.js";
import { EventDeliveries } from "../../interface-adapters/messaging/interfaces.js";
import { Cipher } from "../../interface-adapters/persistence/interfaces.js";
import { LifecycleEventMapper } from "../../interface-adapters/persistence/mappers/lifecycle-event.mapper.js";
import { SecretMapper } from "../../interface-adapters/persistence/mappers/secret.mapper.js";
import { SubscriptionMapper } from "../../interface-adapters/persistence/mappers/subscription.mapper.js";
import { TaskRecordMapper } from "../../interface-adapters/persistence/mappers/task-record.mapper.js";
import { TaskValueMapper } from "../../interface-adapters/persistence/mappers/task-value.mapper.js";
import { WebhookEventMapper } from "../../interface-adapters/persistence/mappers/webhook-event.mapper.js";
import { WorkflowInstanceMapper } from "../../interface-adapters/persistence/mappers/workflow-instance.mapper.js";
import { WorkflowMapper } from "../../interface-adapters/persistence/mappers/workflow.mapper.js";
import { WorkflowVersionMapper } from "../../interface-adapters/persistence/mappers/workflow-version.mapper.js";
import { PostgresInstanceQueries } from "../../interface-adapters/persistence/queries/postgres-instance.queries.js";
import { PostgresSecretQueries } from "../../interface-adapters/persistence/queries/postgres-secret.queries.js";
import { PostgresWorkflowQueries } from "../../interface-adapters/persistence/queries/postgres-workflow.queries.js";
import { PostgresSecretRepository } from "../../interface-adapters/persistence/repositories/postgres-secret.repository.js";
import { PostgresSubscriptionRepository } from "../../interface-adapters/persistence/repositories/postgres-subscription.repository.js";
import { PostgresWorkflowInstanceRepository } from "../../interface-adapters/persistence/repositories/postgres-workflow-instance.repository.js";
import { PostgresWorkflowRepository } from "../../interface-adapters/persistence/repositories/postgres-workflow.repository.js";
import { PostgresEventStore } from "../../interface-adapters/persistence/stores/postgres-event.store.js";
import { PostgresLifecycleEventStore } from "../../interface-adapters/persistence/stores/postgres-lifecycle-event.store.js";
import { PostgresTaskValueStore } from "../../interface-adapters/persistence/stores/postgres-task-value.store.js";
import { EngineRunGateway } from "../../interface-adapters/workflows/gateways/engine-run.gateway.js";
import { EngineScheduleGateway } from "../../interface-adapters/workflows/gateways/engine-schedule.gateway.js";
import { InterpreterFilterGateway } from "../../interface-adapters/workflows/gateways/interpreter-filter.gateway.js";
import { InterpreterRuntimeGateway } from "../../interface-adapters/workflows/gateways/interpreter-runtime.gateway.js";
import { InterpreterClient } from "../../interface-adapters/workflows/interfaces.js";
import { DefinitionMapper } from "../../interface-adapters/workflows/mappers/definition.mapper.js";
import { ProtocolMapper } from "../../interface-adapters/workflows/mappers/protocol.mapper.js";
import { RunTurnMapper } from "../../interface-adapters/workflows/mappers/run-turn.mapper.js";
import { AesGcmCipher } from "../crypto/aes-gcm.cipher.js";
import { AddressPolicy } from "../http-client/address-policy.js";
import { AuthorizationServer } from "../http-client/authorization-server.js";
import { DeliveryClient } from "../http-client/delivery.client.js";
import { HttpClientName } from "../http-client/enums.js";
import { HttpAuthentication } from "../http-client/http-authentication.js";
import { HttpClient } from "../http-client/http.client.js";
import { OpenApiOperations } from "../http-client/openapi-operations.js";
import { ResponseContent } from "../http-client/response-content.js";
import { ResponseSizeLimit } from "../http-client/response-size-limit.js";
import { TransportFailures } from "../http-client/transport-failures.js";
import { WorkerInterpreterClient } from "../interpreter/worker-interpreter.client.js";
import { linksConfig, secretsConfig } from "./configs.js";
import { OutboundModule } from "./outbound.module.js";

@Module({
  imports: [
    ConfigModule.forFeature(secretsConfig),
    ConfigModule.forFeature(linksConfig),
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
    RunTurnMapper,
    DefinitionMapper,
    InterpreterRuntimeGateway,
    { provide: WorkflowRuntime, useExisting: InterpreterRuntimeGateway },
    InterpreterFilterGateway,
    { provide: SubscriptionFilters, useExisting: InterpreterFilterGateway },
    EngineRunGateway,
    { provide: InstanceRuns, useExisting: EngineRunGateway },
    EngineScheduleGateway,
    { provide: WorkflowSchedules, useExisting: EngineScheduleGateway },
    WorkflowMapper,
    WorkflowVersionMapper,
    WorkflowInstanceMapper,
    {
      provide: LifecycleEventMapper,
      inject: [linksConfig.KEY],
      useFactory: (links: ConfigType<typeof linksConfig>) =>
        new LifecycleEventMapper(links.API_BASE_URL),
    },
    TaskRecordMapper,
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
    { provide: InstanceQueries, useClass: PostgresInstanceQueries },
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
    WorkerInterpreterClient,
    { provide: InterpreterClient, useExisting: WorkerInterpreterClient },
    AuthorizationServer,
    HttpAuthentication,
    OpenApiOperations,
    TransportFailures,
    ResponseContent,
    HttpClient,
    DeliveryClient,
    { provide: EventDeliveries, useExisting: DeliveryClient },
    EventDeliveryGateway,
    { provide: EventSender, useExisting: EventDeliveryGateway },
  ],
  exports: [
    CancelInstance,
    ProtocolMapper,
    DefinitionMapper,
    WorkflowRuntime,
    SubscriptionFilters,
    EngineRunGateway,
    InstanceRuns,
    WorkflowSchedules,
    WorkflowRepository,
    WorkflowQueries,
    WorkflowInstanceRepository,
    InstanceQueries,
    EventStore,
    SecretRepository,
    SecretQueries,
    SubscriptionRepository,
    Cipher,
    WorkerInterpreterClient,
    InterpreterClient,
    HttpAuthentication,
    TransportFailures,
    HttpClient,
    EventSender,
  ],
})
export class AutomationModule {}
