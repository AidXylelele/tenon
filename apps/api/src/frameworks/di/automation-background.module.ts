import { Parser } from "@asyncapi/parser";
import { Module } from "@nestjs/common";
import { ConfigModule, type ConfigType } from "@nestjs/config";
import { HttpClientModule } from "@nestjs/http-client";
import { LocksModule } from "@nestjs/locks";
import { DispatchEvent } from "../../application/automation/events/dispatch-event.js";
import {
  EventOffers,
  EventRouting,
} from "../../application/automation/events/ports.js";
import { AnswerChildren } from "../../application/automation/instances/answer-children.js";
import { AnswerReceives } from "../../application/automation/instances/answer-receives.js";
import { AnswerTimer } from "../../application/automation/instances/answer-timer.js";
import { BeginRun } from "../../application/automation/instances/begin-run.js";
import { CancelChildren } from "../../application/automation/instances/cancel-children.js";
import { EmitForEffect } from "../../application/automation/instances/emit-for-effect.js";
import { FailRun } from "../../application/automation/instances/fail-run.js";
import { FindEffectKind } from "../../application/automation/instances/find-effect-kind.js";
import { GiveUpEffect } from "../../application/automation/instances/give-up-effect.js";
import { OfferEvent } from "../../application/automation/instances/offer-event.js";
import { PerformEffect } from "../../application/automation/instances/perform-effect.js";
import {
  ChildCancellations,
  EffectClient,
  ReceivedMessages,
} from "../../application/automation/instances/ports.js";
import { ReceiverQueries } from "../../application/automation/instances/queries.js";
import { ProcessPlatform } from "../../application/automation/host/queries.js";
import { ReceiveForEffect } from "../../application/automation/instances/receive-for-effect.js";
import { ReceiveInbound } from "../../application/automation/instances/receive-inbound.js";
import { RespondToEffect } from "../../application/automation/instances/respond-to-effect.js";
import { StartChildForEffect } from "../../application/automation/instances/start-child-for-effect.js";
import { StartDetachedProcess } from "../../application/automation/instances/start-detached-process.js";
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
import { ConsumerSpan } from "../../interface-adapters/messaging/consumer-span.js";
import { DeliveryMessagesGateway } from "../../interface-adapters/messaging/delivery-messages.gateway.js";
import { DeliveryHandler } from "../../interface-adapters/messaging/delivery.handler.js";
import { EffectHandler } from "../../interface-adapters/messaging/effect.handler.js";
import { RunHandler } from "../../interface-adapters/messaging/run.handler.js";
import { SubscriptionClient } from "../../interface-adapters/messaging/interfaces.js";
import { InboundMapper } from "../../interface-adapters/persistence/mappers/inbound.mapper.js";
import { PostgresReceiverQueries } from "../../interface-adapters/persistence/queries/postgres-receiver.queries.js";
import { PostgresChildCancellationStore } from "../../interface-adapters/persistence/stores/postgres-child-cancellation.store.js";
import { PostgresDeliveryLogStore } from "../../interface-adapters/persistence/stores/postgres-delivery-log.store.js";
import { PostgresEventOfferStore } from "../../interface-adapters/persistence/stores/postgres-event-offer.store.js";
import { PostgresLockStore } from "../../interface-adapters/persistence/stores/postgres-lock.store.js";
import { PostgresReceivedMessageStore } from "../../interface-adapters/persistence/stores/postgres-received-message.store.js";
import { InterpreterRoutingGateway } from "../../interface-adapters/workflows/gateways/interpreter-routing.gateway.js";
import { A2aGateway } from "../../interface-adapters/workflows/effects/a2a.gateway.js";
import { AmqpGateway } from "../../interface-adapters/workflows/effects/amqp.gateway.js";
import { AsyncApiDocuments } from "../../interface-adapters/workflows/effects/asyncapi-documents.js";
import { AsyncApiGateway } from "../../interface-adapters/workflows/effects/asyncapi.gateway.js";
import { EffectDispatcher } from "../../interface-adapters/workflows/effects/effect.dispatcher.js";
import { GrpcGateway } from "../../interface-adapters/workflows/effects/grpc.gateway.js";
import { McpConnection } from "../../interface-adapters/workflows/effects/interfaces.js";
import { KafkaGateway } from "../../interface-adapters/workflows/effects/kafka.gateway.js";
import { McpGateway } from "../../interface-adapters/workflows/effects/mcp.gateway.js";
import { MqttGateway } from "../../interface-adapters/workflows/effects/mqtt.gateway.js";
import { NatsGateway } from "../../interface-adapters/workflows/effects/nats.gateway.js";
import { OpenApiGateway } from "../../interface-adapters/workflows/effects/openapi.gateway.js";
import { ProtoSchema } from "../../interface-adapters/workflows/effects/proto-schema.js";
import { RedisGateway } from "../../interface-adapters/workflows/effects/redis.gateway.js";
import { SandboxGateway } from "../../interface-adapters/workflows/effects/sandbox.gateway.js";
import { SandboxLimits } from "../../interface-adapters/workflows/effects/sandbox-limits.js";
import { RunController } from "../../interface-adapters/workflows/run.controller.js";
import { ScheduleRun } from "../../interface-adapters/workflows/runners/schedule.run.js";
import { AmqpConnection } from "../amqp/amqp.connection.js";
import { parserOptions } from "../asyncapi/parser.options.js";
import { GrpcConnection } from "../grpc/grpc.connection.js";
import { KafkaConnection } from "../kafka/kafka.connection.js";
import { StreamableHttpMcpConnection } from "../mcp/streamable-http.mcp-connection.js";
import { MqttConnection } from "../mqtt/mqtt.connection.js";
import { NatsConnection } from "../nats/nats.connection.js";
import { HttpClientName } from "../network/enums.js";
import { ResponseSizeLimit } from "../network/response-size-limit.js";
import { RedisConnection } from "../redis/redis.connection.js";
import { AutomationModule } from "./automation.module.js";
import { sandboxConfig } from "./configs.js";
import { processPlatform, sandboxLimits } from "./host.presets.js";
import { OutboundModule } from "./outbound.module.js";

@Module({
  imports: [
    AutomationModule,
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
    AnswerReceives,
    AnswerChildren,
    FindEffectKind,
    PerformEffect,
    StartDetachedProcess,
    StartChildForEffect,
    EmitForEffect,
    ReceiveForEffect,
    AnswerTimer,
    GiveUpEffect,
    ReceiveInbound,
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
    ScheduleRun,
    DeliveryMessagesGateway,
    { provide: Deliveries, useExisting: DeliveryMessagesGateway },
    InterpreterRoutingGateway,
    { provide: EventRouting, useExisting: InterpreterRoutingGateway },
    ConsumerSpan,
    AutomationHandler,
    RunHandler,
    EffectHandler,
    DeliveryHandler,
    AsyncApiHandler,
    RetentionJobs,
    InboundMapper,
    { provide: EventOffers, useClass: PostgresEventOfferStore },
    { provide: DeliveryLog, useClass: PostgresDeliveryLogStore },
    { provide: ChildCancellations, useClass: PostgresChildCancellationStore },
    { provide: ReceivedMessages, useClass: PostgresReceivedMessageStore },
    { provide: ReceiverQueries, useClass: PostgresReceiverQueries },
    PostgresLockStore,
    OpenApiGateway,
    GrpcGateway,
    McpGateway,
    A2aGateway,
    AsyncApiGateway,
    SandboxGateway,
    EffectDispatcher,
    { provide: EffectClient, useExisting: EffectDispatcher },
    ProtoSchema,
    GrpcConnection,
    { provide: McpConnection, useClass: StreamableHttpMcpConnection },
    AmqpConnection,
    KafkaConnection,
    MqttConnection,
    NatsConnection,
    RedisConnection,
    { provide: Parser, useFactory: () => new Parser(parserOptions) },
    AsyncApiDocuments,
    AmqpGateway,
    KafkaGateway,
    MqttGateway,
    NatsGateway,
    RedisGateway,
    { provide: SubscriptionClient, useExisting: AsyncApiGateway },
    { provide: SandboxLimits, useValue: sandboxLimits },
    { provide: ProcessPlatform, useValue: processPlatform },
  ],
})
export class AutomationBackgroundModule {}
