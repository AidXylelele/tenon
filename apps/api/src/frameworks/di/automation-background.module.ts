import { Module } from "@nestjs/common";
import { ConfigModule, type ConfigType } from "@nestjs/config";
import {
  getHttpClientToken,
  HttpClientModule,
  type HttpClient as NestHttpClient,
} from "@nestjs/http-client";
import { LocksModule } from "@nestjs/locks";
import { ResilienceService } from "@nestjs/resilience";
import { DispatchEvent } from "../../application/automation/events/dispatch-event.js";
import { EmitEvent } from "../../application/automation/events/emit-event.js";
import {
  EventOffers,
  EventRouting,
} from "../../application/automation/events/ports.js";
import { AnswerChildren } from "../../application/automation/instances/answer-children.js";
import { AnswerReceives } from "../../application/automation/instances/answer-receives.js";
import { BeginRun } from "../../application/automation/instances/begin-run.js";
import { CancelChildren } from "../../application/automation/instances/cancel-children.js";
import { FailRun } from "../../application/automation/instances/fail-run.js";
import { OfferEvent } from "../../application/automation/instances/offer-event.js";
import {
  ChildCancellations,
  ReceivedMessages,
} from "../../application/automation/instances/ports.js";
import { ReceiverQueries } from "../../application/automation/instances/queries.js";
import { ReceiveInbound } from "../../application/automation/instances/receive-inbound.js";
import { RespondToEffect } from "../../application/automation/instances/respond-to-effect.js";
import { StartSubWorkflow } from "../../application/automation/instances/start-sub-workflow.js";
import { WakeParent } from "../../application/automation/instances/wake-parent.js";
import { ContinueSchedule } from "../../application/automation/schedules/continue-schedule.js";
import { StartOnEvent } from "../../application/automation/schedules/start-on-event.js";
import { StartScheduledInstance } from "../../application/automation/schedules/start-scheduled-instance.js";
import { SyncSchedule } from "../../application/automation/schedules/sync-schedule.js";
import { DeliverEvent } from "../../application/automation/subscriptions/deliver-event.js";
import { FailDelivery } from "../../application/automation/subscriptions/fail-delivery.js";
import { MatchSubscriptions } from "../../application/automation/subscriptions/match-subscriptions.js";
import {
  Deliveries,
  DeliveryLog,
} from "../../application/automation/subscriptions/ports.js";
import { RetentionJobs } from "../../interface-adapters/jobs/retention.jobs.js";
import { AsyncApiHandler } from "../../interface-adapters/messaging/asyncapi.handler.js";
import { AutomationHandler } from "../../interface-adapters/messaging/automation.handler.js";
import { SubscriptionClient } from "../../interface-adapters/messaging/interfaces.js";
import { InboundMapper } from "../../interface-adapters/persistence/mappers/inbound.mapper.js";
import { PostgresReceiverQueries } from "../../interface-adapters/persistence/queries/postgres-receiver.queries.js";
import { PostgresChildCancellationStore } from "../../interface-adapters/persistence/stores/postgres-child-cancellation.store.js";
import { PostgresDeliveryLogStore } from "../../interface-adapters/persistence/stores/postgres-delivery-log.store.js";
import { PostgresEventOfferStore } from "../../interface-adapters/persistence/stores/postgres-event-offer.store.js";
import { PostgresLockStore } from "../../interface-adapters/persistence/stores/postgres-lock.store.js";
import { PostgresReceivedMessageStore } from "../../interface-adapters/persistence/stores/postgres-received-message.store.js";
import { EngineDeliveryGateway } from "../../interface-adapters/workflows/gateways/engine-delivery.gateway.js";
import { InterpreterRoutingGateway } from "../../interface-adapters/workflows/gateways/interpreter-routing.gateway.js";
import { EffectClient } from "../../interface-adapters/workflows/interfaces.js";
import { RunController } from "../../interface-adapters/workflows/run.controller.js";
import { DeliveryRun } from "../../interface-adapters/workflows/runners/delivery.run.js";
import { OpenWorkflowRun } from "../../interface-adapters/workflows/runners/open-workflow.run.js";
import { ProcessRun } from "../../interface-adapters/workflows/runners/process.run.js";
import { ScheduleRun } from "../../interface-adapters/workflows/runners/schedule.run.js";
import { A2aClient } from "../a2a/a2a.client.js";
import { AmqpBroker } from "../asyncapi/amqp.broker.js";
import { AsyncApiClient } from "../asyncapi/asyncapi.client.js";
import { AsyncApiDocuments } from "../asyncapi/asyncapi-documents.js";
import { KafkaBroker } from "../asyncapi/kafka.broker.js";
import { MqttBroker } from "../asyncapi/mqtt.broker.js";
import { NatsBroker } from "../asyncapi/nats.broker.js";
import { RedisBroker } from "../asyncapi/redis.broker.js";
import { SandboxClient } from "../go-judge/sandbox.client.js";
import { SandboxLimits } from "../go-judge/sandbox-limits.js";
import { GrpcClient } from "../grpc/grpc.client.js";
import { ProtoSchema } from "../grpc/proto-schema.js";
import { HttpClientName } from "../http-client/enums.js";
import { HttpClient } from "../http-client/http.client.js";
import { ResponseSizeLimit } from "../http-client/response-size-limit.js";
import { EffectPerformer } from "../interpreter/effect-performer.js";
import { McpClient } from "../mcp/mcp.client.js";
import { sandboxConfig } from "./configs.js";
import { CoreModule } from "./core.module.js";
import { OutboundModule } from "./outbound.module.js";

const sandboxLimits = new SandboxLimits({
  time: Temporal.Duration.from({ seconds: 30 }),
  memoryBytes: 256 * 1024 * 1024,
  processes: 50,
  outputBytes: 1024 * 1024,
});

@Module({
  imports: [
    CoreModule,
    OutboundModule,
    LocksModule.forRoot(),
    HttpClientModule.registerAsync({
      name: HttpClientName.Sandbox,
      imports: [ConfigModule.forFeature(sandboxConfig)],
      inject: [sandboxConfig.KEY],
      useFactory: (sandbox: ConfigType<typeof sandboxConfig>) => ({
        baseUrl: sandbox.SANDBOX_URL,
        headers: { authorization: `Bearer ${sandbox.SANDBOX_TOKEN}` },
        interceptors: [new ResponseSizeLimit(sandboxLimits.responseBytes())],
      }),
    }),
  ],
  providers: [
    BeginRun,
    RespondToEffect,
    FailRun,
    EmitEvent,
    StartSubWorkflow,
    AnswerReceives,
    AnswerChildren,
    ReceiveInbound,
    WakeParent,
    CancelChildren,
    OfferEvent,
    DispatchEvent,
    StartOnEvent,
    StartScheduledInstance,
    ContinueSchedule,
    SyncSchedule,
    MatchSubscriptions,
    DeliverEvent,
    FailDelivery,
    RunController,
    OpenWorkflowRun,
    ProcessRun,
    ScheduleRun,
    DeliveryRun,
    EngineDeliveryGateway,
    { provide: Deliveries, useExisting: EngineDeliveryGateway },
    InterpreterRoutingGateway,
    { provide: EventRouting, useExisting: InterpreterRoutingGateway },
    AutomationHandler,
    AsyncApiHandler,
    RetentionJobs,
    InboundMapper,
    { provide: EventOffers, useClass: PostgresEventOfferStore },
    { provide: DeliveryLog, useClass: PostgresDeliveryLogStore },
    { provide: ChildCancellations, useClass: PostgresChildCancellationStore },
    { provide: ReceivedMessages, useClass: PostgresReceivedMessageStore },
    { provide: ReceiverQueries, useClass: PostgresReceiverQueries },
    PostgresLockStore,
    EffectPerformer,
    { provide: EffectClient, useExisting: EffectPerformer },
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
    { provide: SubscriptionClient, useExisting: AsyncApiClient },
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
  ],
})
export class AutomationBackgroundModule {}
