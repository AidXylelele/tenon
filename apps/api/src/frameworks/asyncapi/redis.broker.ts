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
  private static readonly RECONNECT_MS = 1_000;
  private static readonly REFUSED_LOGINS = /^(WRONGPASS|NOAUTH|NOPERM)/;

  readonly system = "redis";
  private readonly connections: BrokerConnections<RedisConnection>;

  constructor(addresses: AddressPolicy) {
    this.connections = new BrokerConnections(addresses, (connection) => {
      connection.destroy();
    });
  }

  async publish(
    target: BrokerTarget,
    message: BrokerMessage,
    credentials: BrokerCredentials,
    signal: AbortSignal,
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
      const abortable = connection.withAbortSignal(signal);
      await abortable.publish(target.address, message.body);
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
    const lost = () => {
      inbox.lost();
    };
    const delivered = (message: Buffer) => {
      this.#delivered(message, inbox);
    };

    try {
      const connection = await this.connections.dedicated(
        target.server,
        (address) => this.#connected(target.server, address, credentials, lost),
      );
      const subscription = { close: () => connection.close() };
      await connection
        .subscribe(target.address, delivered, true)
        .catch(async (error: unknown) => {
          const closed = subscription.close();
          await Promise.allSettled([closed]);
          throw error;
        });
      return { kind: "subscribed", subscription };
    } catch (error) {
      return this.#failureOf(error);
    }
  }

  onApplicationShutdown(): Promise<void> {
    return this.connections.close();
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

  async #connected(
    server: BrokerServer,
    address: string,
    credentials: BrokerCredentials,
    lost: Lost,
  ): Promise<RedisConnection> {
    const login = credentials.kind === "password" ? credentials : null;
    const path = server.pathname.slice(1);
    const database = Number(path) || 0;
    const port = server.port ?? RedisBroker.PORT;
    const named = isIP(server.hostname) === 0;
    const connectTimeout = BrokerConnections.CONNECT_MS;
    const reconnectStrategy = (): number | false =>
      this.#reconnectionOf(connection);
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
    const connection: RedisConnection = createClient({
      socket,
      username: login?.username,
      password: login?.password,
      database,
    });
    connection.on("error", () => undefined);
    connection.on("terminated", lost);
    await this.#opened(connection);
    return connection;
  }

  async #opened(connection: RedisConnection): Promise<void> {
    const destroy = () => {
      connection.destroy();
    };
    const deadline = setTimeout(destroy, BrokerConnections.CONNECT_MS);

    try {
      await connection.connect();
    } finally {
      clearTimeout(deadline);
    }
  }

  #reconnectionOf(connection: RedisConnection): number | false {
    if (connection.socketEpoch === 0) return false;

    return RedisBroker.RECONNECT_MS;
  }

  #failureOf(error: unknown): Failure {
    const detail = error instanceof Error ? error.message : String(error);
    const refused =
      error instanceof ErrorReply && RedisBroker.REFUSED_LOGINS.test(detail);

    if (refused) return { kind: "unauthenticated", detail };

    return { kind: "unreachable", detail };
  }
}
