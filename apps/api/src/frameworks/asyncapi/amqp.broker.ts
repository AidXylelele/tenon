import { isIP } from "node:net";
import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import {
  type Channel,
  type ChannelModel,
  type ConfirmChannel,
  type ConsumeMessage,
  connect,
  type Options,
  type RecoveringChannelModel,
  type RecoveryOptions,
} from "amqplib";
import type { AsyncApiOutcome, Failure } from "interpreter";
import type { Subscribed } from "../../interface-adapters/messaging/interfaces.js";
import { AddressPolicy } from "../network/address-policy.js";
import { AmqpPublisher } from "./amqp-publisher.js";
import { AMQP_CHANNEL } from "./bindings.schema.js";
import { BrokerConnections } from "./broker-connections.js";
import type {
  AmqpBinding,
  AmqpQueue,
  BrokerCredentials,
  BrokerMessage,
  BrokerInbox,
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

  readonly system = "rabbitmq";
  private readonly connections: BrokerConnections<AmqpPublisher>;

  constructor(addresses: AddressPolicy) {
    this.connections = new BrokerConnections(addresses, (publisher) =>
      publisher.close(),
    );
  }

  async publish(
    target: BrokerTarget,
    message: BrokerMessage,
    credentials: BrokerCredentials,
  ): Promise<AsyncApiOutcome> {
    const declared = target.bindings.channel.amqp ?? {};
    const binding = AMQP_CHANNEL.safeParse(declared);

    if (!binding.success) return AmqpBroker.UNREAD_BINDING;

    try {
      const publisher = await this.connections.of(
        target.server,
        credentials,
        (address, lost) =>
          this.#publisher(target.server, address, credentials, lost),
      );
      const channel = await publisher.channel();
      this.#sent(channel, binding.data, target.address, message);
      await channel.waitForConfirms();
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
    const declared = target.bindings.channel.amqp ?? {};
    const binding = AMQP_CHANNEL.safeParse(declared);

    if (!binding.success) return AmqpBroker.UNREAD_BINDING;

    const lost = () => {
      inbox.lost();
    };
    const setup = (connected: ChannelModel) =>
      this.#consumed(connected, binding.data, target, inbox);

    try {
      const model = await this.connections.dedicated(target.server, (address) =>
        this.#recovering(target.server, address, credentials, lost, setup),
      );
      await model.waitForConnect();
      const subscription = { close: () => model.close() };
      return { kind: "subscribed", subscription };
    } catch (error) {
      return this.#failureOf(error);
    }
  }

  onApplicationShutdown(): Promise<void> {
    return this.connections.close();
  }

  async #publisher(
    server: BrokerServer,
    address: string,
    credentials: BrokerCredentials,
    lost: Lost,
  ): Promise<AmqpPublisher> {
    const model = await this.#recovering(server, address, credentials, lost);
    const publisher = new AmqpPublisher(model);
    await model.waitForConnect();
    return publisher;
  }

  async #recovering(
    server: BrokerServer,
    address: string,
    credentials: BrokerCredentials,
    lost: Lost,
    setup?: RecoveryOptions["setup"],
  ): Promise<RecoveringChannelModel> {
    const port = server.secure ? AmqpBroker.SECURE_PORT : AmqpBroker.PORT;
    const login = credentials.kind === "password" ? credentials : null;
    const named = isIP(server.hostname) === 0;
    const vhost = this.#vhostOf(server);
    const recovery = {
      waitForConnect: false,
      initialMaxRetries: 0,
      maxRetries: Infinity,
      setup,
    };
    const endpoint: Options.Connect = {
      protocol: server.secure ? "amqps" : "amqp",
      hostname: address,
      port: server.port ?? port,
      username: login?.username,
      password: login?.password,
      vhost,
    };
    const socket = {
      servername: named ? server.hostname : undefined,
      timeout: BrokerConnections.CONNECT_MS,
      recovery,
    };
    const model = await connect(endpoint, socket);
    model.on("error", () => undefined);
    model.on("reconnect-failed", lost);
    return model;
  }

  #sent(
    channel: ConfirmChannel,
    binding: AmqpBinding,
    address: string,
    message: BrokerMessage,
  ): void {
    const options: Options.Publish = {
      headers: { ...message.headers },
      messageId: message.idempotencyKey,
      contentType: message.contentType,
      persistent: true,
    };
    const exchange = binding.exchange.name;

    if (binding.is === "routingKey" && exchange !== undefined) {
      channel.publish(exchange, address, message.body, options);
      return;
    }

    const queue = binding.queue.name ?? address;
    channel.sendToQueue(queue, message.body, options);
  }

  async #consumed(
    connected: ChannelModel,
    binding: AmqpBinding,
    target: BrokerTarget,
    inbox: BrokerInbox,
  ): Promise<void> {
    const channel = await connected.createChannel();
    const lost = () => {
      inbox.lost();
    };
    channel.on("error", lost);
    const queue = await this.#queueOf(channel, binding, target.address, inbox);
    await channel.prefetch(AmqpBroker.IN_FLIGHT);
    await channel.consume(
      queue.name,
      (message) => {
        if (message === null) {
          inbox.lost();
          return;
        }

        void this.#handled(channel, message, inbox, queue.shared).catch(lost);
      },
      { noAck: false },
    );
  }

  async #handled(
    channel: Channel,
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
    channel: Channel,
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

    const refusedLogin = detail.includes(AmqpBroker.REFUSED_LOGIN);

    if (refusedLogin) return { kind: "unauthenticated", detail };

    return { kind: "unreachable", detail };
  }
}
