import { isIP } from "node:net";
import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { createClient, type RedisClientType } from "redis";
import type { PasswordCredentials } from "../../interface-adapters/workflows/effects/interfaces.js";
import { AddressPolicy } from "../network/address-policy.js";
import { BrokerConnections } from "../network/broker-connections.js";
import type { BrokerServer, Lost } from "../network/interfaces.js";

@Injectable()
export class RedisConnection implements OnApplicationShutdown {
  private static readonly PORT = 6379;
  private static readonly RECONNECT_MS = 1_000;

  private readonly connections: BrokerConnections<RedisClientType>;

  constructor(addresses: AddressPolicy) {
    this.connections = new BrokerConnections(addresses, (client) => {
      client.destroy();
    });
  }

  clientOf(
    server: BrokerServer,
    login: PasswordCredentials | null,
  ): Promise<RedisClientType> {
    return this.connections.of(server, login, (address, lost) =>
      this.#connected(server, address, login, lost),
    );
  }

  subscriberOf(
    server: BrokerServer,
    login: PasswordCredentials | null,
    lost: Lost,
  ): Promise<RedisClientType> {
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
    login: PasswordCredentials | null,
    lost: Lost,
  ): Promise<RedisClientType> {
    const path = server.pathname.slice(1);
    const database = Number(path) || 0;
    const port = server.port ?? RedisConnection.PORT;
    const named = isIP(server.hostname) === 0;
    const connectTimeout = BrokerConnections.CONNECT_MS;
    const reconnectStrategy = (): number | false =>
      this.#reconnectionOf(client);
    const socket = server.secure
      ? {
          tls: true as const,
          host: address,
          port,
          servername: named ? server.hostname : undefined,
          connectTimeout,
          reconnectStrategy,
        }
      : { host: address, port, connectTimeout, reconnectStrategy };
    const client: RedisClientType = createClient({
      socket,
      username: login?.username,
      password: login?.password,
      database,
    });
    client.on("error", () => undefined);
    client.on("terminated", lost);
    await this.#opened(client);
    return client;
  }

  async #opened(client: RedisClientType): Promise<void> {
    const destroy = () => {
      client.destroy();
    };
    const deadline = setTimeout(destroy, BrokerConnections.CONNECT_MS);

    try {
      await client.connect();
    } finally {
      clearTimeout(deadline);
    }
  }

  #reconnectionOf(client: RedisClientType): number | false {
    if (client.socketEpoch === 0) return false;

    return RedisConnection.RECONNECT_MS;
  }
}
