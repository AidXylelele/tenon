import { isIP } from "node:net";
import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import {
  type ChannelModel,
  type ConfirmChannel,
  connect,
  type Options,
  type RecoveringChannelModel,
  type RecoveryOptions,
} from "amqplib";
import { AddressPolicy } from "../network/address-policy.js";
import { BrokerConnections } from "../network/broker-connections.js";
import type { BrokerServer, Login, Lost } from "../network/interfaces.js";
import { AmqpPublisher } from "./amqp-publisher.js";
import type { MessageHandler, QueueDeclaration } from "./interfaces.js";

@Injectable()
export class AmqpConnection implements OnApplicationShutdown {
  private static readonly PORT = 5672;
  private static readonly SECURE_PORT = 5671;
  private static readonly DEFAULT_VHOST = "/";
  private static readonly IN_FLIGHT = 1;

  private readonly connections: BrokerConnections<AmqpPublisher>;

  constructor(addresses: AddressPolicy) {
    this.connections = new BrokerConnections(addresses, (publisher) =>
      publisher.close(),
    );
  }

  async channelOf(
    server: BrokerServer,
    login: Login | null,
  ): Promise<ConfirmChannel> {
    const publisher = await this.connections.of(
      server,
      "",
      login,
      (address, lost) => this.#publisher(server, address, login, lost),
    );
    return publisher.channel();
  }

  async consume(
    server: BrokerServer,
    login: Login | null,
    declare: QueueDeclaration,
    handle: MessageHandler,
    lost: Lost,
  ): Promise<RecoveringChannelModel> {
    const setup = (connected: ChannelModel) =>
      this.#consumed(connected, declare, handle, lost);
    const model = await this.connections.dedicated(server, (address) =>
      this.#recovering(server, address, login, lost, setup),
    );
    await model.waitForConnect();
    return model;
  }

  onApplicationShutdown(): Promise<void> {
    return this.connections.close();
  }

  async #consumed(
    connected: ChannelModel,
    declare: QueueDeclaration,
    handle: MessageHandler,
    lost: Lost,
  ): Promise<void> {
    const channel = await connected.createChannel();
    channel.on("error", lost);
    const queue = await declare(channel);
    await channel.prefetch(AmqpConnection.IN_FLIGHT);
    await channel.consume(
      queue,
      (message) => {
        if (message === null) {
          lost();
          return;
        }

        handle(channel, message);
      },
      { noAck: false },
    );
  }

  async #publisher(
    server: BrokerServer,
    address: string,
    login: Login | null,
    lost: Lost,
  ): Promise<AmqpPublisher> {
    const model = await this.#recovering(server, address, login, lost);
    const publisher = new AmqpPublisher(model);
    await model.waitForConnect();
    return publisher;
  }

  async #recovering(
    server: BrokerServer,
    address: string,
    login: Login | null,
    lost: Lost,
    setup?: RecoveryOptions["setup"],
  ): Promise<RecoveringChannelModel> {
    const port = server.secure
      ? AmqpConnection.SECURE_PORT
      : AmqpConnection.PORT;
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

  #vhostOf(server: BrokerServer): string {
    const path = server.pathname.slice(1);

    if (path === "") return AmqpConnection.DEFAULT_VHOST;

    return decodeURIComponent(path);
  }
}
