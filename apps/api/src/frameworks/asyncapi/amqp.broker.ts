import { isIP } from "node:net";
import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { type ConsumeMessage, connect, type Options } from "amqplib";
import type { AsyncApiOutcome, Failure } from "interpreter";
import { AddressPolicy } from "../http-client/address-policy.js";
import { AMQP_CHANNEL } from "./bindings.schema.js";
import { BrokerConnections } from "./broker-connections.js";
import type {
  AmqpBinding,
  AmqpConnection,
  AmqpQueue,
  BrokerCredentials,
  BrokerMessage,
  BrokerInbox,
  Subscribed,
  BrokerClient,
  BrokerServer,
  BrokerTarget,
  Lost,
  ReceivedBrokerMessage,
} from "./interfaces.js";

@Injectable()
export class AmqpBroker implements BrokerClient, OnApplicationShutdown {
  private static readonly IN_FLIGHT = 1;
  private static readonly QUEUE_PREFIX = "tenon.";
  private static readonly QUEUE_EXPIRES_MS = 15 * 60 * 1000;
  private static readonly UNREAD_BINDING: Failure = {
    kind: "misconfigured",
    detail: "The channel's amqp binding is not one the host reads",
  };
  private static readonly PORT = 5672;
  private static readonly SECURE_PORT = 5671;
  private static readonly DEFAULT_VHOST = "/";
  private static readonly REFUSED_LOGIN = "ACCESS_REFUSED";

  private readonly connections: BrokerConnections<AmqpConnection>;

  constructor(addresses: AddressPolicy) {
    this.connections = new BrokerConnections(addresses, (connection) =>
      connection.model.close(),
    );
  }

  async publish(
    target: BrokerTarget,
    message: BrokerMessage,
    credentials: BrokerCredentials,
  ): Promise<AsyncApiOutcome> {
    const binding = AMQP_CHANNEL.safeParse(target.bindings.channel.amqp ?? {});

    if (!binding.success)
      return {
        kind: "misconfigured",
        detail: "The channel's amqp binding is not one the host reads",
      };

    try {
      const connection = await this.connections.of(
        target.server,
        credentials,
        (address, lost) =>
          this.#connected(target.server, address, credentials, lost),
      );
      this.#sent(connection, binding.data, target.address, message);
      await connection.channel.waitForConfirms();
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
    const binding = AMQP_CHANNEL.safeParse(target.bindings.channel.amqp ?? {});

    if (!binding.success) return AmqpBroker.UNREAD_BINDING;

    try {
      const connection = await this.connections.dedicated(
        target.server,
        (address) =>
          this.#connected(target.server, address, credentials, () => {
            inbox.lost();
          }),
      );
      const subscription = { close: () => connection.model.close() };
      await this.#consumed(connection, binding.data, target, inbox).catch(
        async (error: unknown) => {
          await Promise.allSettled([subscription.close()]);
          throw error;
        },
      );
      return { kind: "subscribed", subscription };
    } catch (error) {
      return this.#failureOf(error);
    }
  }

  onApplicationShutdown(): Promise<void> {
    return this.connections.close();
  }

  async #connected(
    server: BrokerServer,
    address: string,
    credentials: BrokerCredentials,
    lost: Lost,
  ): Promise<AmqpConnection> {
    const port = server.secure ? AmqpBroker.SECURE_PORT : AmqpBroker.PORT;
    const login = credentials.kind === "password" ? credentials : null;
    const named = isIP(server.hostname) === 0;
    const model = await connect(
      {
        protocol: server.secure ? "amqps" : "amqp",
        hostname: address,
        port: server.port ?? port,
        username: login?.username,
        password: login?.password,
        vhost: this.#vhostOf(server),
      },
      { servername: named ? server.hostname : undefined },
    );
    model.on("error", lost);
    model.on("close", lost);
    const channel = await model.createConfirmChannel();
    channel.on("error", lost);
    channel.on("close", () => {
      void model.close().then(lost, lost);
    });
    return { model, channel };
  }

  #sent(
    connection: AmqpConnection,
    binding: AmqpBinding,
    address: string,
    message: BrokerMessage,
  ): void {
    const options: Options.Publish = {
      headers: message.headers,
      messageId: message.idempotencyKey,
      contentType: message.contentType,
      persistent: true,
    };
    const exchange = binding.exchange.name;

    if (binding.is === "routingKey" && exchange !== undefined) {
      connection.channel.publish(exchange, address, message.body, options);
      return;
    }

    const queue = binding.queue.name ?? address;
    connection.channel.sendToQueue(queue, message.body, options);
  }

  async #consumed(
    connection: AmqpConnection,
    binding: AmqpBinding,
    target: BrokerTarget,
    inbox: BrokerInbox,
  ): Promise<void> {
    const channel = connection.channel;
    const queue = await this.#queueOf(channel, binding, target.address, inbox);
    await channel.prefetch(AmqpBroker.IN_FLIGHT);
    await channel.consume(
      queue.name,
      (message) => {
        if (message === null) {
          inbox.lost();
          return;
        }

        void this.#handled(channel, message, inbox, queue.shared).catch(() => {
          inbox.lost();
        });
      },
      { noAck: false },
    );
  }

  async #handled(
    channel: AmqpConnection["channel"],
    message: ConsumeMessage,
    inbox: BrokerInbox,
    shared: boolean,
  ): Promise<void> {
    try {
      if (shared) await inbox.demanded();

      const received = this.#receivedOf(message);
      await inbox.deliver(received);
      channel.ack(message);
    } catch {
      if (!inbox.ended.aborted) channel.nack(message);
    }
  }

  #receivedOf(message: ConsumeMessage): ReceivedBrokerMessage {
    const properties = message.properties;
    return {
      body: message.content,
      contentType: this.#textOf(properties.contentType),
      headers: properties.headers ?? {},
      correlationId: this.#textOf(properties.correlationId),
    };
  }

  async #queueOf(
    channel: AmqpConnection["channel"],
    binding: AmqpBinding,
    address: string,
    inbox: BrokerInbox,
  ): Promise<AmqpQueue> {
    const exchange = binding.exchange.name;

    if (binding.is !== "routingKey" || exchange === undefined)
      return { name: binding.queue.name ?? address, shared: true };

    const name = `${AmqpBroker.QUEUE_PREFIX}${inbox.subscriber}`;
    const options = { durable: true, expires: AmqpBroker.QUEUE_EXPIRES_MS };
    await channel.assertQueue(name, options);
    await channel.bindQueue(name, exchange, address);
    return { name, shared: false };
  }

  #textOf(value: unknown): string | null {
    return typeof value === "string" ? value : null;
  }

  #vhostOf(server: BrokerServer): string {
    const path = server.pathname.slice(1);

    if (path === "") return AmqpBroker.DEFAULT_VHOST;

    return decodeURIComponent(path);
  }

  #failureOf(error: unknown): Failure {
    const detail = error instanceof Error ? error.message : String(error);

    if (detail.includes(AmqpBroker.REFUSED_LOGIN))
      return { kind: "unauthenticated", detail };

    return { kind: "unreachable", detail };
  }
}
