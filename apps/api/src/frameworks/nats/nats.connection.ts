import { isIP } from "node:net";
import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import {
  connect,
  type NatsConnection as NatsClient,
} from "@nats-io/transport-node";
import { AddressPolicy } from "../http/address-policy.js";
import { BrokerConnections } from "../asyncapi/broker-connections.js";
import type { BrokerServer, Login, Lost } from "../asyncapi/interfaces.js";
import type { NatsTls } from "./interfaces.js";

@Injectable()
export class NatsConnection implements OnApplicationShutdown {
  private static readonly PORT = 4222;
  private static readonly RECONNECTS_FOREVER = -1;

  private readonly connections: BrokerConnections<NatsClient>;

  constructor(addresses: AddressPolicy) {
    this.connections = new BrokerConnections(addresses, (client) =>
      client.close(),
    );
  }

  clientOf(server: BrokerServer, login: Login | null): Promise<NatsClient> {
    return this.connections.of(server, "", login, (address, lost) =>
      this.#connected(server, address, login, lost),
    );
  }

  subscriberOf(
    server: BrokerServer,
    login: Login | null,
    lost: Lost,
  ): Promise<NatsClient> {
    return this.connections.dedicated(server, (address) =>
      this.#connected(server, address, login, lost),
    );
  }

  onApplicationShutdown(): Promise<void> {
    return this.connections.close();
  }

  async #connected(
    server: BrokerServer,
    address: string,
    login: Login | null,
    lost: Lost,
  ): Promise<NatsClient> {
    const ipv6 = isIP(address) === 6;
    const host = ipv6 ? `[${address}]` : address;
    const port = server.port ?? NatsConnection.PORT;
    const servers = `${host}:${String(port)}`;
    const tls = server.secure ? this.#tlsOf(server) : undefined;
    const client = await connect({
      servers,
      user: login?.username,
      pass: login?.password,
      tls,
      timeout: BrokerConnections.CONNECT_MS,
      reconnect: true,
      maxReconnectAttempts: NatsConnection.RECONNECTS_FOREVER,
      waitOnFirstConnect: false,
      ignoreClusterUpdates: true,
    });
    void client.closed().then(lost);
    return client;
  }

  #tlsOf(server: BrokerServer): NatsTls {
    const named = isIP(server.hostname) === 0;
    return named ? { servername: server.hostname } : {};
  }
}
