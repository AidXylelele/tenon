import { aborted } from "node:util";
import { Injectable } from "@nestjs/common";
import { type ResiliencePolicy, ResilienceService } from "@nestjs/resilience";
import type {
  AsyncApiOutcome,
  AsyncApiRequest,
  Authentication,
  Failure,
  JsonObject,
  JsonValue,
} from "interpreter";
import { ResponseSizeLimit } from "../../../frameworks/network/response-size-limit.js";
import type {
  AsyncApiInbox,
  Subscribed,
  SubscriptionClient,
} from "../../messaging/interfaces.js";
import { ResourceClient, type StepCall } from "../interfaces.js";
import { AmqpGateway } from "./amqp.gateway.js";
import { AsyncApiDocuments } from "./asyncapi-documents.js";
import { Authenticator } from "./authenticator.js";
import { BrokerProtocol } from "./enums.js";
import type {
  BasicCredentials,
  BrokerGateway,
  BrokerInbox,
  BrokerMessage,
  BrokerTarget,
  CallContext,
  Expired,
  ReceivedBrokerMessage,
  Targeted,
  UnusableSecret,
} from "./interfaces.js";
import { KafkaGateway } from "./kafka.gateway.js";
import { MqttGateway } from "./mqtt.gateway.js";
import { NatsGateway } from "./nats.gateway.js";
import { RedisGateway } from "./redis.gateway.js";
import { TransportFailures } from "./transport-failures.js";

@Injectable()
export class AsyncApiGateway implements SubscriptionClient {
  private static readonly JSON = /^application\/(?:[\w.+-]+\+)?json\b/i;
  private static readonly EXPIRED: Expired = { kind: "expired" };

  private readonly policy: ResiliencePolicy;
  private readonly brokers: ReadonlyMap<string, BrokerGateway>;

  constructor(
    private readonly resources: ResourceClient,
    private readonly authentication: Authenticator,
    private readonly documents: AsyncApiDocuments,
    private readonly limit: ResponseSizeLimit,
    private readonly failures: TransportFailures,
    amqp: AmqpGateway,
    kafka: KafkaGateway,
    mqtt: MqttGateway,
    nats: NatsGateway,
    redis: RedisGateway,
    resilience: ResilienceService,
  ) {
    this.policy = resilience.preset("asyncapi-calls");
    const brokers: Readonly<Record<BrokerProtocol, BrokerGateway>> = {
      [BrokerProtocol.Amqp]: amqp,
      [BrokerProtocol.Amqps]: amqp,
      [BrokerProtocol.Kafka]: kafka,
      [BrokerProtocol.KafkaSecure]: kafka,
      [BrokerProtocol.Mqtt]: mqtt,
      [BrokerProtocol.Mqtt5]: mqtt,
      [BrokerProtocol.SecureMqtt]: mqtt,
      [BrokerProtocol.Nats]: nats,
      [BrokerProtocol.Redis]: redis,
    };
    const entries = Object.entries(brokers);
    this.brokers = new Map(entries);
  }

  async perform(
    request: AsyncApiRequest,
    context: CallContext,
  ): Promise<AsyncApiOutcome> {
    const exchange = request.exchange;

    if (exchange.kind === "receive")
      throw new Error(
        "A receive is a wait of the run that the host's receivers answer",
      );

    const target = await this.#targetOf(request, context);

    if (target.kind !== "target") return target;

    const protocol = target.server.protocol;
    const broker = this.brokers.get(protocol);

    if (broker === undefined)
      return {
        kind: "misconfigured",
        detail: `The host does not publish over the protocol '${protocol}'`,
      };

    const login = this.#loginOf(request.authentication, context.secrets);

    if (login !== null && login.kind !== "basic") return login;

    const body = this.#bodyOf(exchange.message.payload, target.contentType);

    if (body.length > this.limit.bytes) {
      const size = this.limit.inMebibytes();
      return {
        kind: "misconfigured",
        detail: `The message is larger than the host's ${size}`,
      };
    }

    const message = {
      body,
      contentType: target.contentType,
      headers: exchange.message.headers,
      idempotencyKey: context.idempotencyKey,
      login,
    };
    return this.#published(broker, target, message, context.signal);
  }

  async subscribe(
    request: AsyncApiRequest,
    step: StepCall,
    inbox: AsyncApiInbox,
  ): Promise<Subscribed> {
    const context: CallContext = {
      idempotencyKey: step.idempotencyKey,
      signal: step.signal,
      secrets: step.secrets,
      remaining: null,
    };
    const target = await this.#targetOf(request, context);

    if (target.kind !== "target") return target;

    const protocol = target.server.protocol;
    const broker = this.brokers.get(protocol);

    if (broker === undefined)
      return {
        kind: "misconfigured",
        detail: `The host does not receive over the protocol '${protocol}'`,
      };

    const login = this.#loginOf(request.authentication, step.secrets);

    if (login !== null && login.kind !== "basic") return login;

    const brokerInbox = this.#brokerInboxOf(target, step, inbox);
    const subscribing = broker.subscribe(target, login, brokerInbox);
    const subscribed = await this.#within(subscribing, inbox.ended);

    if (subscribed === AsyncApiGateway.EXPIRED)
      void this.#abandoned(subscribing);

    return subscribed;
  }

  async #targetOf(
    request: AsyncApiRequest,
    context: CallContext,
  ): Promise<Targeted | Failure> {
    const document = await this.resources.text(request.document, context);

    if (document.kind !== "text") return document;

    return this.documents.targetOf(document.text, request);
  }

  async #published(
    broker: BrokerGateway,
    target: BrokerTarget,
    message: BrokerMessage,
    signal: AbortSignal,
  ): Promise<AsyncApiOutcome> {
    const publishing = this.policy.execute(
      (attempt) => broker.publish(target, message, attempt.signal),
      { signal },
    );

    try {
      return await this.#within(publishing, signal);
    } catch (error) {
      return this.failures.of(error, signal);
    }
  }

  #within<T>(work: Promise<T>, signal: AbortSignal): Promise<T | Expired> {
    const ended = aborted(signal, work);
    const expired = ended.then(() => AsyncApiGateway.EXPIRED);
    return Promise.race([work, expired]);
  }

  async #abandoned(subscribing: Promise<Subscribed>): Promise<void> {
    const late = await subscribing;

    if (late.kind !== "subscribed") return;

    const closed = late.subscription.close();
    await Promise.allSettled([closed]);
  }

  #brokerInboxOf(
    target: BrokerTarget,
    step: StepCall,
    inbox: AsyncApiInbox,
  ): BrokerInbox {
    return {
      subscriber: step.idempotencyKey,
      ended: inbox.ended,
      demanded: () => inbox.demanded(),
      deliver: (message) => this.#delivered(message, target, inbox),
      lost: () => {
        inbox.lost();
      },
    };
  }

  #loginOf(
    authentication: Authentication | null,
    secrets: JsonObject,
  ): BasicCredentials | UnusableSecret | null {
    const credentials = this.authentication.credentialsOf(
      authentication,
      secrets,
    );

    if (credentials === null) return null;

    switch (credentials.kind) {
      case "forbidden":
      case "misconfigured":
      case "basic":
        return credentials;
      case "bearer":
      case "oauth2":
      case "oidc":
        return {
          kind: "misconfigured",
          detail: "A broker is authenticated with basic credentials only",
        };
    }
  }

  async #delivered(
    message: ReceivedBrokerMessage,
    target: BrokerTarget,
    inbox: AsyncApiInbox,
  ): Promise<void> {
    if (message.body.length > this.limit.bytes) {
      const size = this.limit.inMebibytes();
      const oversized: Failure = {
        kind: "misconfigured",
        detail: `A received message is larger than the host's ${size}`,
      };
      await inbox.failure(oversized);
      return;
    }

    const contentType = message.contentType ?? target.contentType;
    const payload = this.#payloadOf(message.body, contentType);
    const inbound = {
      payload,
      headers: message.headers,
      correlationId: message.correlationId,
    };
    await inbox.message(inbound);
  }

  #payloadOf(body: Buffer, contentType: string): JsonValue {
    const text = body.toString("utf8");
    const json = AsyncApiGateway.JSON.test(contentType);

    if (!json) return text;

    try {
      return JSON.parse(text) as JsonValue;
    } catch {
      return text;
    }
  }

  #bodyOf(payload: JsonValue, contentType: string): Buffer {
    const json = AsyncApiGateway.JSON.test(contentType);
    const text =
      typeof payload === "string" && !json ? payload : JSON.stringify(payload);
    return Buffer.from(text, "utf8");
  }
}
