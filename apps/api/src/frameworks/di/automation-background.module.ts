import { Parser } from "@asyncapi/parser";
import { Module } from "@nestjs/common";
import { ConfigModule, type ConfigType } from "@nestjs/config";
import { HttpClientModule } from "@nestjs/http-client";
import { LocksModule } from "@nestjs/locks";
import { DispatchEvent } from "../../application/automation/events/dispatch-event.js";
import {
  EventListeners,
  EventRouting,
} from "../../application/automation/events/ports.js";
import { AnswerChildren } from "../../application/automation/instances/answer-children.js";
import { AnswerReceives } from "../../application/automation/instances/answer-receives.js";
import { AnswerTimer } from "../../application/automation/instances/answer-timer.js";
import { BeginRun } from "../../application/automation/instances/begin-run.js";
import { CancelChildren } from "../../application/automation/instances/cancel-children.js";
import { EmitForEffect } from "../../application/automation/instances/emit-for-effect.js";
import { FailRun } from "../../application/automation/instances/fail-run.js";
import { GiveUpEffect } from "../../application/automation/instances/give-up-effect.js";
import { OfferEvent } from "../../application/automation/instances/offer-event.js";
import { PerformDetachedProcess } from "../../application/automation/instances/perform-detached-process.js";
import { PerformEffect } from "../../application/automation/instances/perform-effect.js";
import {
  EffectPerformer,
  ReceivedMessages,
} from "../../application/automation/instances/ports.js";
import { ReceiverQueries } from "../../application/automation/instances/queries.js";
import { ProcessPlatform } from "../../application/automation/host/queries.js";
import { ReceiveInbound } from "../../application/automation/instances/receive-inbound.js";
import { RespondToEffect } from "../../application/automation/instances/respond-to-effect.js";
import { StartChildForEffect } from "../../application/automation/instances/start-child-for-effect.js";
import { StartDetachedProcess } from "../../application/automation/instances/start-detached-process.js";
import { ContinueSchedule } from "../../application/automation/schedules/continue-schedule.js";
import { StartOnEvent } from "../../application/automation/schedules/start-on-event.js";
import { FireSchedule } from "../../application/automation/schedules/fire-schedule.js";
import { StartScheduledInstance } from "../../application/automation/schedules/start-scheduled-instance.js";
import { DeliverEvent } from "../../application/automation/subscriptions/deliver-event.js";
import { FailDelivery } from "../../application/automation/subscriptions/fail-delivery.js";
import { MatchSubscriptions } from "../../application/automation/subscriptions/match-subscriptions.js";
import {
  Deliveries,
  DeliveryLog,
} from "../../application/automation/subscriptions/ports.js";
import { AsyncApiGateway } from "../../interface-adapters/asyncapi/asyncapi.gateway.js";
import {
  AsyncApiDocuments,
  BrokerClient,
} from "../../interface-adapters/asyncapi/interfaces.js";
import { ReceiverController } from "../../interface-adapters/asyncapi/receiver.controller.js";
import { A2aGateway } from "../../interface-adapters/a2a/a2a.gateway.js";
import { A2aClient } from "../../interface-adapters/a2a/interfaces.js";
import { GrpcGateway } from "../../interface-adapters/grpc/grpc.gateway.js";
import { GrpcClient } from "../../interface-adapters/grpc/interfaces.js";
import { OpenApiClient } from "../../interface-adapters/http/interfaces.js";
import { OpenApiGateway } from "../../interface-adapters/http/openapi.gateway.js";
import { McpClient } from "../../interface-adapters/mcp/interfaces.js";
import { McpGateway } from "../../interface-adapters/mcp/mcp.gateway.js";
import { SandboxClient } from "../../interface-adapters/sandbox/interfaces.js";
import { SandboxGateway } from "../../interface-adapters/sandbox/sandbox.gateway.js";
import { SandboxLimits } from "../../interface-adapters/sandbox/sandbox-limits.js";
import { MessageRetries } from "../../interface-adapters/messaging/message-retries.js";
import { RetentionJobs } from "../../interface-adapters/jobs/retention.jobs.js";
import { AutomationHandler } from "../../interface-adapters/messaging/handlers/automation.handler.js";
import { DeliveryMessagesProducer } from "../../interface-adapters/messaging/producers/delivery-messages.producer.js";
import { DeliveryHandler } from "../../interface-adapters/messaging/handlers/delivery.handler.js";
import { EffectHandler } from "../../interface-adapters/messaging/handlers/effect.handler.js";
import { RunHandler } from "../../interface-adapters/messaging/handlers/run.handler.js";
import { ScheduleHandler } from "../../interface-adapters/messaging/handlers/schedule.handler.js";
import { InboundMapper } from "../../interface-adapters/persistence/mappers/inbound.mapper.js";
import { PostgresReceiverQueries } from "../../interface-adapters/persistence/queries/postgres-receiver.queries.js";
import { PostgresDeliveryLogStore } from "../../interface-adapters/persistence/stores/postgres-delivery-log.store.js";
import { PostgresEventListenerStore } from "../../interface-adapters/persistence/stores/postgres-event-listener.store.js";
import { PostgresLockStore } from "../../interface-adapters/persistence/stores/postgres-lock.store.js";
import { PostgresReceivedMessageStore } from "../../interface-adapters/persistence/stores/postgres-received-message.store.js";
import { InterpreterRoutingGateway } from "../../interface-adapters/interpreter/interpreter-routing.gateway.js";
import { EffectGateway } from "../../interface-adapters/interpreter/effect.gateway.js";
import { AmqpBroker } from "../amqp/amqp.broker.js";
import { AmqpConnection } from "../amqp/amqp.connection.js";
import { ParserAsyncApiDocuments } from "../asyncapi/parser.asyncapi-documents.js";
import { parserOptions } from "../asyncapi/parser.options.js";
import { ReceiverSubscriptions } from "../asyncapi/receiver-subscriptions.js";
import { RoutedBrokerClient } from "../asyncapi/routed.broker-client.js";
import { JsonRpcA2aClient } from "../a2a/json-rpc.a2a-client.js";
import { GoJudgeSandboxClient } from "../go-judge/go-judge.sandbox-client.js";
import { GrpcConnection } from "../grpc/grpc.connection.js";
import { ProtoGrpcClient } from "../grpc/proto.grpc-client.js";
import { ProtoSchema } from "../grpc/proto-schema.js";
import { KafkaBroker } from "../kafka/kafka.broker.js";
import { KafkaConnection } from "../kafka/kafka.connection.js";
import { StreamableHttpMcpClient } from "../mcp/streamable-http.mcp-client.js";
import { MqttBroker } from "../mqtt/mqtt.broker.js";
import { MqttConnection } from "../mqtt/mqtt.connection.js";
import { NatsBroker } from "../nats/nats.broker.js";
import { NatsConnection } from "../nats/nats.connection.js";
import { HttpClientName } from "../http/enums.js";
import { ResponseSizeLimit } from "../http/response-size-limit.js";
import { SwaggerOpenApiClient } from "../openapi/swagger.openapi-client.js";
import { RedisBroker } from "../redis/redis.broker.js";
import { RedisConnection } from "../redis/redis.connection.js";
import { AutomationModule } from "./automation.module.js";
import { sandboxConfig } from "./configs.js";
import {
  messageRetries,
  processPlatform,
  sandboxLimits,
} from "./host.presets.js";
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
    PerformEffect,
    StartDetachedProcess,
    PerformDetachedProcess,
    StartChildForEffect,
    EmitForEffect,
    AnswerTimer,
    GiveUpEffect,
    ReceiveInbound,
    CancelChildren,
    OfferEvent,
    DispatchEvent,
    StartOnEvent,
    FireSchedule,
    StartScheduledInstance,
    ContinueSchedule,
    MatchSubscriptions,
    DeliverEvent,
    FailDelivery,
    ReceiverController,
    DeliveryMessagesProducer,
    { provide: Deliveries, useExisting: DeliveryMessagesProducer },
    InterpreterRoutingGateway,
    { provide: EventRouting, useExisting: InterpreterRoutingGateway },
    AutomationHandler,
    RunHandler,
    EffectHandler,
    DeliveryHandler,
    ScheduleHandler,
    ReceiverSubscriptions,
    RetentionJobs,
    InboundMapper,
    { provide: EventListeners, useClass: PostgresEventListenerStore },
    { provide: DeliveryLog, useClass: PostgresDeliveryLogStore },
    { provide: ReceivedMessages, useClass: PostgresReceivedMessageStore },
    { provide: ReceiverQueries, useClass: PostgresReceiverQueries },
    PostgresLockStore,
    OpenApiGateway,
    GrpcGateway,
    McpGateway,
    A2aGateway,
    AsyncApiGateway,
    SandboxGateway,
    { provide: SandboxClient, useClass: GoJudgeSandboxClient },
    EffectGateway,
    { provide: EffectPerformer, useExisting: EffectGateway },
    { provide: OpenApiClient, useClass: SwaggerOpenApiClient },
    ProtoSchema,
    GrpcConnection,
    { provide: GrpcClient, useClass: ProtoGrpcClient },
    { provide: McpClient, useClass: StreamableHttpMcpClient },
    { provide: A2aClient, useClass: JsonRpcA2aClient },
    AmqpConnection,
    KafkaConnection,
    MqttConnection,
    NatsConnection,
    RedisConnection,
    { provide: Parser, useFactory: () => new Parser(parserOptions) },
    { provide: AsyncApiDocuments, useClass: ParserAsyncApiDocuments },
    AmqpBroker,
    KafkaBroker,
    MqttBroker,
    NatsBroker,
    RedisBroker,
    { provide: BrokerClient, useClass: RoutedBrokerClient },
    { provide: SandboxLimits, useValue: sandboxLimits },
    { provide: ProcessPlatform, useValue: processPlatform },
    { provide: MessageRetries, useValue: messageRetries },
  ],
})
export class AutomationBackgroundModule {}
