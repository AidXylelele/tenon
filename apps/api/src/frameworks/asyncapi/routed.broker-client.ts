import { aborted } from "node:util";
import { Injectable } from "@nestjs/common";
import { type ResiliencePolicy, ResilienceService } from "@nestjs/resilience";
import type { JsonValue } from "interpreter";
import type {
  BrokerClient,
  BrokerInbox,
  BrokerMessage,
  BrokerSubscription,
  BrokerTarget,
} from "../../interface-adapters/asyncapi/interfaces.js";
import type { PasswordCredentials } from "../../interface-adapters/auth/interfaces.js";
import { TransportFailure } from "../../interface-adapters/http/enums.js";
import { TransportFault } from "../../interface-adapters/http/transport-fault.error.js";
import { AmqpBroker } from "../amqp/amqp.broker.js";
import { ResponseSizeLimit } from "../http/response-size-limit.js";
import { TransportFaults } from "../http/transport-faults.js";
import { KafkaBroker } from "../kafka/kafka.broker.js";
import { MqttBroker } from "../mqtt/mqtt.broker.js";
import { NatsBroker } from "../nats/nats.broker.js";
import { RedisBroker } from "../redis/redis.broker.js";
import { BrokerProtocol } from "./enums.js";
import type {
  Broker,
  EncodedInbox,
  ReceivedBrokerMessage,
} from "./interfaces.js";

@Injectable()
export class RoutedBrokerClient implements BrokerClient {
  private static readonly JSON = /^application\/(?:[\w.+-]+\+)?json\b/i;

  private readonly policy: ResiliencePolicy;
  private readonly brokers: ReadonlyMap<string, Broker>;

  constructor(
    private readonly limit: ResponseSizeLimit,
    private readonly faults: TransportFaults,
    amqp: AmqpBroker,
    kafka: KafkaBroker,
    mqtt: MqttBroker,
    nats: NatsBroker,
    redis: RedisBroker,
    resilience: ResilienceService,
  ) {
    this.policy = resilience.preset("asyncapi-calls");
    const brokers: Readonly<Record<BrokerProtocol, Broker>> = {
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

  async publish(
    target: BrokerTarget,
    message: BrokerMessage,
    signal: AbortSignal,
  ): Promise<void> {
    const broker = this.#brokerOf(target, "publish");
    const body = this.#bodyOf(message.payload, message.contentType);

    if (body.length > this.limit.bytes) {
      const size = this.limit.inMebibytes();
      throw this.#misconfigured(
        `The message is larger than the host's ${size}`,
      );
    }

    const encoded = {
      body,
      contentType: message.contentType,
      headers: message.headers,
      idempotencyKey: message.idempotencyKey,
      login: message.login,
    };
    const publishing = this.policy.execute(
      (attempt) => broker.publish(target, encoded, attempt.signal),
      { signal },
    );

    try {
      await this.#within(publishing, signal);
    } catch (error) {
      throw this.faults.of(error, signal);
    }
  }

  async subscribe(
    target: BrokerTarget,
    login: PasswordCredentials | null,
    inbox: BrokerInbox,
  ): Promise<BrokerSubscription> {
    const broker = this.#brokerOf(target, "receive");
    const encoded = this.#encodedInboxOf(target, inbox);
    const subscribing = broker.subscribe(target, login, encoded);

    try {
      return await this.#within(subscribing, inbox.ended);
    } catch (error) {
      if (inbox.ended.aborted) void this.#abandoned(subscribing);

      throw this.faults.of(error, inbox.ended);
    }
  }

  async #within<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
    const ended = aborted(signal, work);
    const expired = ended.then((): never => {
      throw this.faults.expired();
    });
    return Promise.race([work, expired]);
  }

  async #abandoned(subscribing: Promise<BrokerSubscription>): Promise<void> {
    const late = await subscribing.catch(() => null);

    if (late === null) return;

    const closed = late.close();
    await Promise.allSettled([closed]);
  }

  #brokerOf(target: BrokerTarget, exchange: string): Broker {
    const protocol = target.server.protocol;
    const broker = this.brokers.get(protocol);

    if (broker === undefined)
      throw this.#misconfigured(
        `The host does not ${exchange} over the protocol '${protocol}'`,
      );

    return broker;
  }

  #encodedInboxOf(target: BrokerTarget, inbox: BrokerInbox): EncodedInbox {
    return {
      subscriber: inbox.subscriber,
      ended: inbox.ended,
      demanded: () => inbox.demanded(),
      deliver: (message) => this.#delivered(message, target, inbox),
      lost: () => {
        inbox.lost();
      },
    };
  }

  async #delivered(
    message: ReceivedBrokerMessage,
    target: BrokerTarget,
    inbox: BrokerInbox,
  ): Promise<void> {
    if (message.body.length > this.limit.bytes) {
      const size = this.limit.inMebibytes();
      await inbox.refuse(
        `A received message is larger than the host's ${size}`,
      );
      return;
    }

    const contentType = message.contentType ?? target.contentType;
    const payload = this.#payloadOf(message.body, contentType);
    const inbound = {
      payload,
      headers: message.headers,
      correlationId: message.correlationId,
    };
    await inbox.deliver(inbound);
  }

  #payloadOf(body: Buffer, contentType: string): JsonValue {
    const text = body.toString("utf8");
    const json = RoutedBrokerClient.JSON.test(contentType);

    if (!json) return text;

    try {
      return JSON.parse(text) as JsonValue;
    } catch {
      return text;
    }
  }

  #bodyOf(payload: JsonValue, contentType: string): Buffer {
    const json = RoutedBrokerClient.JSON.test(contentType);
    const text =
      typeof payload === "string" && !json ? payload : JSON.stringify(payload);
    return Buffer.from(text, "utf8");
  }

  #misconfigured(detail: string): TransportFault {
    return new TransportFault(TransportFailure.Misconfigured, detail);
  }
}
