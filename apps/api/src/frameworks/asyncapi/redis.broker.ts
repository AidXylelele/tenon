import { isIP } from "node:net";
import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import type { AsyncApiOutcome, Failure } from "interpreter";
import { createClient, ErrorReply } from "redis";
import type { Subscribed } from "../../interface-adapters/messaging/interfaces.js";
import { AddressPolicy } from "../http-client/address-policy.js";
import { BrokerConnections } from "./broker-connections.js";
import type {
  BrokerCredentials,
  BrokerMessage,
  BrokerInbox,
  BrokerClient,
  BrokerServer,
  BrokerTarget,
  Lost,
  RedisConnection,
} from "./interfaces.js";

@Injectable()
export class RedisBroker implements BrokerClient, OnApplicationShutdown {
  private static readonly PORT = 6379;
  private static readonly REFUSED_LOGINS = /^(WRONGPASS|NOAUTH|NOPERM)/;

  private readonly connections: BrokerConnections<RedisConnection>;

  constructor(addresses: AddressPolicy) {
    this.connections = new BrokerConnections(addresses, (connection) =>
      connection.close(),
    );
  }

  async publish(
    target: BrokerTarget,
    message: BrokerMessage,
    credentials: BrokerCredentials,
  ): Promise<AsyncApiOutcome> {
    const headed = Object.keys(message.headers).length > 0;

    if (headed)
      return {
        kind: "misconfigured",
        detail: "A Redis channel carries no headers",
      };

    try {
      const connection = await this.connections.of(
        target.server,
        credentials,
        (address, lost) =>
          this.#connected(target.server, address, credentials, lost),
      );
      await connection.publish(target.address, message.body);
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
    try {
      const connection = await this.connections.dedicated(
        target.server,
        (address) =>
          this.#connected(target.server, address, credentials, () => {
            inbox.lost();
          }),
      );
      await connection.subscribe(
        target.address,
        (message: Buffer) => {
          this.#delivered(message, inbox);
        },
        true,
      );
      const subscription = { close: () => connection.close() };
      return { kind: "subscribed", subscription };
    } catch (error) {
      return this.#failureOf(error);
    }
  }

  #delivered(body: Buffer, inbox: BrokerInbox): void {
    const received = {
      body,
      contentType: null,
      headers: {},
      correlationId: null,
    };
    inbox.deliver(received).catch(() => {
      inbox.lost();
    });
  }

  onApplicationShutdown(): Promise<void> {
    return this.connections.close();
  }

  async #connected(
    server: BrokerServer,
    address: string,
    credentials: BrokerCredentials,
    lost: Lost,
  ): Promise<RedisConnection> {
    const login = credentials.kind === "password" ? credentials : null;
    const database = Number(server.pathname.slice(1)) || 0;
    const port = server.port ?? RedisBroker.PORT;
    const named = isIP(server.hostname) === 0;
    const socket = server.secure
      ? {
          tls: true as const,
          host: address,
          port,
          servername: named ? server.hostname : undefined,
          reconnectStrategy: false as const,
        }
      : { host: address, port, reconnectStrategy: false as const };
    const connection = createClient({
      socket,
      username: login?.username,
      password: login?.password,
      database,
    });
    connection.on("error", lost);
    await connection.connect();
    return connection;
  }

  #failureOf(error: unknown): Failure {
    const detail = error instanceof Error ? error.message : String(error);
    const refused =
      error instanceof ErrorReply && RedisBroker.REFUSED_LOGINS.test(detail);

    if (refused) return { kind: "unauthenticated", detail };

    return { kind: "unreachable", detail };
  }
}
