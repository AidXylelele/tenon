import { Injectable } from "@nestjs/common";
import {
  type AttemptContext,
  type ResiliencePolicy,
  ResilienceService,
  ResilienceTimeoutError,
} from "@nestjs/resilience";
import type {
  AsyncApiMessage,
  AsyncApiOutcome,
  AsyncApiRequest,
  Authentication,
  Failure,
  JsonObject,
  JsonValue,
} from "interpreter";
import { PermanentFault } from "../../domain/errors.js";
import { HttpAuthentication } from "../http-client/http-authentication.js";
import { HttpClient } from "../http-client/http.client.js";
import type { UnusableSecret } from "../http-client/interfaces.js";
import { ResponseSizeLimit } from "../http-client/response-size-limit.js";
import type {
  AsyncApiInbox,
  Subscribed,
  SubscriptionClient,
} from "../../interface-adapters/messaging/interfaces.js";
import type { StepCall } from "../../interface-adapters/workflows/interfaces.js";
import type { CallContext } from "../interpreter/interfaces.js";
import { AmqpBroker } from "./amqp.broker.js";
import { AsyncApiDocuments } from "./asyncapi-documents.js";
import { BrokerSpans } from "./broker-spans.js";
import type {
  BrokerCredentials,
  BrokerClient,
  BrokerTarget,
  Expired,
  ReceivedBrokerMessage,
} from "./interfaces.js";
import { BrokerProtocol } from "./enums.js";
import { KafkaBroker } from "./kafka.broker.js";
import { MqttBroker } from "./mqtt.broker.js";
import { NatsBroker } from "./nats.broker.js";
import { RedisBroker } from "./redis.broker.js";

@Injectable()
export class AsyncApiClient implements SubscriptionClient {
  private static readonly JSON = /^application\/(?:[\w.+-]+\+)?json\b/i;
  private static readonly ANONYMOUS: BrokerCredentials = { kind: "anonymous" };
  private static readonly EXPIRED: Expired = { kind: "expired" };

  private readonly policy: ResiliencePolicy;
  private readonly brokers: ReadonlyMap<string, BrokerClient>;

  constructor(
    private readonly http: HttpClient,
    private readonly authentication: HttpAuthentication,
    private readonly documents: AsyncApiDocuments,
    private readonly spans: BrokerSpans,
    private readonly limit: ResponseSizeLimit,
    amqp: AmqpBroker,
    kafka: KafkaBroker,
    mqtt: MqttBroker,
    nats: NatsBroker,
    redis: RedisBroker,
    resilience: ResilienceService,
  ) {
    this.policy = resilience.preset("asyncapi-calls");
    const brokers: Readonly<Record<BrokerProtocol, BrokerClient>> = {
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
    this.brokers = new Map(Object.entries(brokers));
  }

  async publish(
    request: AsyncApiRequest,
    call: CallContext,
  ): Promise<AsyncApiOutcome> {
    const exchange = request.exchange;

    if (exchange.kind === "receive")
      throw new PermanentFault(
        "A receive is a wait of the run that the host's receivers answer",
      );

    const document = await this.http.text(request.document, call);

    if (document.kind !== "text") return document;

    const target = await this.documents.targetOf(document.text, request);

    if (target.kind !== "target") return target;

    return this.#published(
      target,
      exchange.message,
      request.authentication,
      call,
    );
  }

  async subscribe(
    request: AsyncApiRequest,
    step: StepCall,
    inbox: AsyncApiInbox,
  ): Promise<Subscribed> {
    const call: CallContext = {
      idempotencyKey: step.idempotencyKey,
      signal: step.signal,
      secrets: step.secrets,
      remaining: null,
    };
    const document = await this.http.text(request.document, call);

    if (document.kind !== "text") return document;

    const target = await this.documents.targetOf(document.text, request);

    if (target.kind !== "target") return target;

    const protocol = target.server.protocol;
    const broker = this.brokers.get(protocol);

    if (broker === undefined)
      return {
        kind: "misconfigured",
        detail: `The host does not receive over the protocol '${protocol}'`,
      };

    const credentials = this.#credentialsOf(
      request.authentication,
      call.secrets,
    );

    if (credentials.kind !== "anonymous" && credentials.kind !== "password")
      return credentials;

    const brokerInbox = {
      subscriber: call.idempotencyKey,
      ended: inbox.ended,
      demanded: () => inbox.demanded(),
      deliver: (message: ReceivedBrokerMessage) => {
        const delivering = () => this.#delivered(message, target, inbox);
        return this.spans.processing(
          target,
          broker.system,
          message.headers,
          delivering,
        );
      },
      lost: () => {
        inbox.lost();
      },
    };
    const subscribing = broker.subscribe(target, credentials, brokerInbox);
    const subscribed = await this.#within(subscribing, inbox.ended);

    if (subscribed === AsyncApiClient.EXPIRED)
      void this.#abandoned(subscribing);

    return subscribed;
  }

  async #published(
    target: BrokerTarget,
    message: AsyncApiMessage,
    authentication: Authentication | null,
    call: CallContext,
  ): Promise<AsyncApiOutcome> {
    const protocol = target.server.protocol;
    const publisher = this.brokers.get(protocol);

    if (publisher === undefined)
      return {
        kind: "misconfigured",
        detail: `The host does not publish over the protocol '${protocol}'`,
      };

    const credentials = this.#credentialsOf(authentication, call.secrets);

    if (credentials.kind !== "anonymous" && credentials.kind !== "password")
      return credentials;

    const body = this.#bodyOf(message.payload, target.contentType);

    if (body.length > this.limit.bytes) {
      const size = this.limit.inMebibytes();
      return {
        kind: "misconfigured",
        detail: `The message is larger than the host's ${size}`,
      };
    }

    const sent = {
      body,
      contentType: target.contentType,
      headers: message.headers,
      idempotencyKey: call.idempotencyKey,
    };
    const publishing = (attempt: AttemptContext) =>
      publisher.publish(target, sent, credentials, attempt.signal);
    const bounded = () => this.#bounded(publishing, call.signal);
    return this.spans.sending(target, publisher.system, bounded);
  }

  async #bounded(
    publishing: (attempt: AttemptContext) => Promise<AsyncApiOutcome>,
    signal: AbortSignal,
  ): Promise<AsyncApiOutcome> {
    const executed = this.policy.execute(publishing, { signal });

    try {
      return await this.#within(executed, signal);
    } catch (error) {
      return this.#failureOf(error, signal);
    }
  }

  async #within<T>(
    work: Promise<T>,
    signal: AbortSignal,
  ): Promise<T | Expired> {
    const settled = new AbortController();
    const expired = this.#expiredOn(signal, settled.signal);

    try {
      return await Promise.race([work, expired]);
    } finally {
      settled.abort();
    }
  }

  async #abandoned(subscribing: Promise<Subscribed>): Promise<void> {
    const late = await subscribing;

    if (late.kind !== "subscribed") return;

    await Promise.allSettled([late.subscription.close()]);
  }

  #expiredOn(signal: AbortSignal, settled: AbortSignal): Promise<Expired> {
    if (signal.aborted) return Promise.resolve(AsyncApiClient.EXPIRED);

    return new Promise((resolve) => {
      const expire = () => {
        resolve(AsyncApiClient.EXPIRED);
      };
      signal.addEventListener("abort", expire, { once: true, signal: settled });
    });
  }

  #credentialsOf(
    authentication: Authentication | null,
    secrets: JsonObject,
  ): BrokerCredentials | UnusableSecret {
    const credentials = this.authentication.credentialsOf(
      authentication,
      secrets,
    );

    if (credentials === null) return AsyncApiClient.ANONYMOUS;

    switch (credentials.kind) {
      case "forbidden":
      case "misconfigured":
        return credentials;
      case "basic":
        return {
          kind: "password",
          username: credentials.username,
          password: credentials.password,
        };
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
    const json = AsyncApiClient.JSON.test(contentType);

    if (!json) return text;

    try {
      return JSON.parse(text) as JsonValue;
    } catch {
      return text;
    }
  }

  #bodyOf(payload: JsonValue, contentType: string): Buffer {
    const json = AsyncApiClient.JSON.test(contentType);
    const text =
      typeof payload === "string" && !json ? payload : JSON.stringify(payload);
    return Buffer.from(text, "utf8");
  }

  #failureOf(error: unknown, signal: AbortSignal): AsyncApiOutcome {
    if (signal.aborted || error instanceof ResilienceTimeoutError)
      return AsyncApiClient.EXPIRED;

    throw error;
  }
}
