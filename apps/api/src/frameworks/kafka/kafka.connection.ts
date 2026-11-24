import { isIP } from "node:net";
import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import {
  type Base,
  type ClusterMetadata,
  Consumer,
  MessagesStreamFallbackModes,
  MessagesStreamModes,
  Producer,
  SASLMechanisms,
  type SASLOptions,
  stringDeserializer,
  stringSerializer,
} from "@platformatic/kafka";
import { AddressPolicy } from "../http/address-policy.js";
import { BrokerConnections } from "../asyncapi/broker-connections.js";
import type { BrokerServer } from "../../interface-adapters/asyncapi/interfaces.js";
import type { PasswordCredentials } from "../../interface-adapters/auth/interfaces.js";
import type { Lost } from "../asyncapi/interfaces.js";
import type {
  KafkaConsumer,
  KafkaProducer,
  KafkaRecord,
  KafkaStream,
} from "./interfaces.js";

@Injectable()
export class KafkaConnection implements OnApplicationShutdown {
  private static readonly PORT = 9092;
  private static readonly CLIENT_ID = "tenon";
  private static readonly ANY_FAMILY = 0;

  private readonly connections: BrokerConnections<KafkaProducer>;

  constructor(private readonly addresses: AddressPolicy) {
    this.connections = new BrokerConnections(addresses, (producer) =>
      producer.close(),
    );
  }

  async send(
    server: BrokerServer,
    login: PasswordCredentials | null,
    record: KafkaRecord,
  ): Promise<void> {
    const producer = await this.connections.of(
      server,
      "",
      login,
      (address, lost) => this.#producer(server, address, login, lost),
    );
    await this.#checked(producer, record.topic);
    await producer.send({ messages: [record] });
  }

  async consume(
    server: BrokerServer,
    login: PasswordCredentials | null,
    groupId: string,
    topic: string,
    lost: Lost,
  ): Promise<KafkaStream> {
    const consumer = await this.connections.dedicated(server, (address) =>
      this.#consumer(server, address, login, groupId, lost),
    );

    try {
      return await this.#streamOf(consumer, topic);
    } catch (error) {
      const closed = consumer.close(true);
      await Promise.allSettled([closed]);
      throw error;
    }
  }

  onApplicationShutdown(): Promise<void> {
    return this.connections.close();
  }

  #producer(
    server: BrokerServer,
    address: string,
    login: PasswordCredentials | null,
    lost: Lost,
  ): Promise<KafkaProducer> {
    const bootstrap = this.#bootstrapOf(server, address);
    const tls = server.secure ? {} : undefined;
    const tlsServerName = this.#serverNameOf(server);
    const sasl = this.#saslOf(login);
    const producer = new Producer({
      clientId: KafkaConnection.CLIENT_ID,
      bootstrapBrokers: [bootstrap],
      tls,
      tlsServerName,
      sasl,
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
    login: PasswordCredentials | null,
    groupId: string,
    lost: Lost,
  ): Promise<KafkaConsumer> {
    const bootstrap = this.#bootstrapOf(server, address);
    const tls = server.secure ? {} : undefined;
    const tlsServerName = this.#serverNameOf(server);
    const sasl = this.#saslOf(login);
    const consumer = new Consumer({
      clientId: KafkaConnection.CLIENT_ID,
      groupId,
      bootstrapBrokers: [bootstrap],
      tls,
      tlsServerName,
      sasl,
      connectTimeout: BrokerConnections.CONNECT_MS,
      deserializers: {
        headerKey: stringDeserializer,
        headerValue: stringDeserializer,
      },
    });
    consumer.on("client:metadata", (metadata) => {
      this.#guarded(metadata, lost);
    });
    return Promise.resolve(consumer);
  }

  async #streamOf(
    consumer: KafkaConsumer,
    topic: string,
  ): Promise<KafkaStream> {
    await this.#checked(consumer, topic);
    return consumer.consume({
      topics: [topic],
      mode: MessagesStreamModes.COMMITTED,
      fallbackMode: MessagesStreamFallbackModes.LATEST,
      autocommit: false,
    });
  }

  async #checked(client: Base, topic: string): Promise<void> {
    const metadata = await client.metadata({ topics: [topic] });

    for (const broker of metadata.brokers.values())
      await this.addresses.resolve(broker.host, KafkaConnection.ANY_FAMILY);
  }

  #guarded(metadata: ClusterMetadata, refused: () => void): void {
    for (const broker of metadata.brokers.values()) {
      const host = broker.host;
      const literal = isIP(host) !== 0;
      const refusedHost = literal && !this.addresses.permits(host);

      if (refusedHost) {
        refused();
        return;
      }

      void this.addresses
        .resolve(host, KafkaConnection.ANY_FAMILY)
        .catch(refused);
    }
  }

  #bootstrapOf(server: BrokerServer, address: string): string {
    const ipv6 = isIP(address) === 6;
    const host = ipv6 ? `[${address}]` : address;
    const port = server.port ?? KafkaConnection.PORT;
    return `${host}:${String(port)}`;
  }

  #serverNameOf(server: BrokerServer): string | undefined {
    const named = isIP(server.hostname) === 0;
    return server.secure && named ? server.hostname : undefined;
  }

  #saslOf(login: PasswordCredentials | null): SASLOptions | undefined {
    if (login === null) return undefined;

    return {
      mechanism: SASLMechanisms.PLAIN,
      username: login.username,
      password: login.password,
    };
  }
}
