import { isIP } from "node:net";
import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import {
  AuthenticationError,
  type Base,
  type ClusterMetadata,
  Consumer,
  type MessagesStream,
  MessagesStreamFallbackModes,
  MessagesStreamModes,
  Producer,
  SASLMechanisms,
  type SASLOptions,
  stringDeserializer,
  stringSerializer,
} from "@platformatic/kafka";
import { context, propagation } from "@opentelemetry/api";
import type { AsyncApiOutcome, Failure } from "interpreter";
import type { Subscribed } from "../../interface-adapters/messaging/interfaces.js";
import { AddressPolicy } from "../http-client/address-policy.js";
import { KAFKA_CHANNEL } from "./bindings.schema.js";
import { BrokerConnections } from "./broker-connections.js";
import type {
  BrokerClient,
  BrokerCredentials,
  BrokerMessage,
  BrokerServer,
  BrokerTarget,
  BrokerInbox,
  KafkaConsumer,
  KafkaProducer,
  Lost,
} from "./interfaces.js";

@Injectable()
export class KafkaBroker implements BrokerClient, OnApplicationShutdown {
  private static readonly PORT = 9092;
  private static readonly CLIENT_ID = "tenon";
  private static readonly CONTENT_TYPE = "content-type";
  private static readonly ANY_FAMILY = 0;
  private static readonly TOMBSTONE = Buffer.alloc(0);
  private static readonly UNREAD_BINDING: Failure = {
    kind: "misconfigured",
    detail: "The channel's kafka binding is not one the host reads",
  };

  readonly system = "kafka";
  private readonly connections: BrokerConnections<KafkaProducer>;

  constructor(private readonly addresses: AddressPolicy) {
    this.connections = new BrokerConnections(addresses, (producer) =>
      producer.close(),
    );
  }

  async publish(
    target: BrokerTarget,
    message: BrokerMessage,
    credentials: BrokerCredentials,
  ): Promise<AsyncApiOutcome> {
    const binding = KAFKA_CHANNEL.safeParse(
      target.bindings.channel.kafka ?? {},
    );

    if (!binding.success) return KafkaBroker.UNREAD_BINDING;

    const topic = binding.data.topic ?? target.address;
    const headers = this.#headersOf(message);

    try {
      const producer = await this.connections.of(
        target.server,
        credentials,
        (address, lost) =>
          this.#producer(target.server, address, credentials, lost),
      );
      await this.#checked(producer, topic);
      const sent = { topic, value: message.body, headers };
      await producer.send({ messages: [sent] });
      return { kind: "published" };
    } catch (error) {
      return this.#failureOf(error);
    }
  }

  async subscribe(
    target: BrokerTarget,
    credentials: BrokerCredentials,
    inbox: BrokerInbox,
  ): Promise<Subscribed> {
    const binding = KAFKA_CHANNEL.safeParse(
      target.bindings.channel.kafka ?? {},
    );

    if (!binding.success) return KafkaBroker.UNREAD_BINDING;

    const topic = binding.data.topic ?? target.address;

    try {
      const consumer = await this.connections.dedicated(
        target.server,
        (address) => this.#consumer(target.server, address, credentials, inbox),
      );
      const subscription = { close: () => consumer.close(true) };
      const stream = await this.#streamOf(consumer, topic).catch(
        async (error: unknown) => {
          await Promise.allSettled([subscription.close()]);
          throw error;
        },
      );
      const lost = () => {
        inbox.lost();
      };
      void this.#consumed(stream, inbox).then(lost, lost);
      return { kind: "subscribed", subscription };
    } catch (error) {
      return this.#failureOf(error);
    }
  }

  onApplicationShutdown(): Promise<void> {
    return this.connections.close();
  }

  #producer(
    server: BrokerServer,
    address: string,
    credentials: BrokerCredentials,
    lost: Lost,
  ): Promise<KafkaProducer> {
    const producer = new Producer({
      clientId: KafkaBroker.CLIENT_ID,
      bootstrapBrokers: [this.#bootstrapOf(server, address)],
      tls: server.secure ? {} : undefined,
      tlsServerName: this.#serverNameOf(server),
      sasl: this.#saslOf(credentials),
      connectTimeout: BrokerConnections.CONNECT_MS,
      retries: false,
      serializers: {
        headerKey: stringSerializer,
        headerValue: stringSerializer,
      },
    });
    producer.on("client:metadata", (metadata) => {
      this.#guarded(metadata, () => {
        lost();
        void producer.close(true);
      });
    });
    return Promise.resolve(producer);
  }

  #consumer(
    server: BrokerServer,
    address: string,
    credentials: BrokerCredentials,
    inbox: BrokerInbox,
  ): Promise<KafkaConsumer> {
    const consumer = new Consumer({
      clientId: KafkaBroker.CLIENT_ID,
      groupId: inbox.subscriber,
      bootstrapBrokers: [this.#bootstrapOf(server, address)],
      tls: server.secure ? {} : undefined,
      tlsServerName: this.#serverNameOf(server),
      sasl: this.#saslOf(credentials),
      connectTimeout: BrokerConnections.CONNECT_MS,
      deserializers: {
        headerKey: stringDeserializer,
        headerValue: stringDeserializer,
      },
    });
    consumer.on("client:metadata", (metadata) => {
      this.#guarded(metadata, () => {
        inbox.lost();
      });
    });
    return Promise.resolve(consumer);
  }

  async #streamOf(
    consumer: KafkaConsumer,
    topic: string,
  ): Promise<MessagesStream<Buffer, Buffer, string, string>> {
    await this.#checked(consumer, topic);
    return consumer.consume({
      topics: [topic],
      mode: MessagesStreamModes.COMMITTED,
      fallbackMode: MessagesStreamFallbackModes.LATEST,
      autocommit: false,
    });
  }

  async #consumed(
    stream: MessagesStream<Buffer, Buffer, string, string>,
    inbox: BrokerInbox,
  ): Promise<void> {
    for await (const message of stream) {
      const headers = Object.fromEntries(message.headers);
      const contentType = headers[KafkaBroker.CONTENT_TYPE] ?? null;
      const body = message.value ?? KafkaBroker.TOMBSTONE;
      const received = {
        body,
        contentType,
        headers,
        correlationId: null,
      };
      await inbox.deliver(received);
      await message.commit();
    }
  }

  async #checked(client: Base, topic: string): Promise<void> {
    const metadata = await client.metadata({ topics: [topic] });

    for (const broker of metadata.brokers.values())
      await this.addresses.resolve(broker.host, KafkaBroker.ANY_FAMILY);
  }

  #guarded(metadata: ClusterMetadata, refused: () => void): void {
    for (const broker of metadata.brokers.values()) {
      const host = broker.host;

      if (isIP(host) !== 0 && !this.addresses.permits(host)) {
        refused();
        return;
      }

      void this.addresses.resolve(host, KafkaBroker.ANY_FAMILY).catch(refused);
    }
  }

  #bootstrapOf(server: BrokerServer, address: string): string {
    const host = isIP(address) === 6 ? `[${address}]` : address;
    const port = server.port ?? KafkaBroker.PORT;
    return `${host}:${String(port)}`;
  }

  #serverNameOf(server: BrokerServer): string | undefined {
    const named = isIP(server.hostname) === 0;
    return server.secure && named ? server.hostname : undefined;
  }

  #saslOf(credentials: BrokerCredentials): SASLOptions | undefined {
    if (credentials.kind !== "password") return undefined;

    return {
      mechanism: SASLMechanisms.PLAIN,
      username: credentials.username,
      password: credentials.password,
    };
  }

  #headersOf(message: BrokerMessage): Record<string, string> {
    const headers: Record<string, string> = {
      [KafkaBroker.CONTENT_TYPE]: message.contentType,
    };

    for (const [name, value] of Object.entries(message.headers))
      headers[name] = typeof value === "string" ? value : JSON.stringify(value);

    const active = context.active();
    propagation.inject(active, headers);
    return headers;
  }

  #failureOf(error: unknown): Failure {
    const detail = error instanceof Error ? error.message : String(error);

    if (error instanceof AuthenticationError)
      return { kind: "unauthenticated", detail };

    return { kind: "unreachable", detail };
  }
}
