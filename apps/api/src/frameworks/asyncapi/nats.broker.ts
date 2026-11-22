import { isIP } from "node:net";
import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import {
  connect,
  errors,
  headers,
  type Msg,
  type MsgHdrs,
  type NatsConnection,
} from "@nats-io/transport-node";
import type { AsyncApiOutcome, Failure } from "interpreter";
import { AddressPolicy } from "../http-client/address-policy.js";
import { BrokerConnections } from "./broker-connections.js";
import type {
  BrokerCredentials,
  BrokerMessage,
  BrokerInbox,
  Subscribed,
  BrokerClient,
  BrokerServer,
  BrokerTarget,
  Lost,
  NatsTls,
} from "./interfaces.js";

@Injectable()
export class NatsBroker implements BrokerClient, OnApplicationShutdown {
  private static readonly PORT = 4222;
  private static readonly MESSAGE_ID = "Nats-Msg-Id";

  private readonly connections: BrokerConnections<NatsConnection>;

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
    try {
      const connection = await this.connections.of(
        target.server,
        credentials,
        (address, lost) =>
          this.#connected(target.server, address, credentials, lost),
      );
      const sent = this.#headersOf(message);
      connection.publish(target.address, message.body, { headers: sent });
      await connection.flush();
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
      connection.subscribe(target.address, {
        callback: (error, message) => {
          if (error !== null) {
            inbox.lost();
            return;
          }

          this.#delivered(message, inbox);
        },
      });
      const subscription = { close: () => connection.drain() };
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
  ): Promise<NatsConnection> {
    const host = isIP(address) === 6 ? `[${address}]` : address;
    const port = server.port ?? NatsBroker.PORT;
    const login = credentials.kind === "password" ? credentials : null;
    const connection = await connect({
      servers: `${host}:${String(port)}`,
      user: login?.username,
      pass: login?.password,
      tls: server.secure ? this.#tlsOf(server) : undefined,
      reconnect: false,
      ignoreClusterUpdates: true,
    });
    void connection.closed().then(lost);
    return connection;
  }

  #delivered(message: Msg, inbox: BrokerInbox): void {
    const body = Buffer.from(message.data);
    const headers = this.#receivedHeadersOf(message.headers);
    const received = { body, contentType: null, headers, correlationId: null };
    inbox.deliver(received).catch(() => {
      inbox.lost();
    });
  }

  #receivedHeadersOf(received: MsgHdrs | undefined): Record<string, string> {
    const headers: Record<string, string> = {};

    for (const name of received?.keys() ?? [])
      headers[name] = received?.get(name) ?? "";

    return headers;
  }

  #headersOf(message: BrokerMessage): MsgHdrs {
    const sent = headers();

    for (const [name, value] of Object.entries(message.headers)) {
      const text = typeof value === "string" ? value : JSON.stringify(value);
      sent.set(name, text);
    }

    sent.set(NatsBroker.MESSAGE_ID, message.idempotencyKey);
    return sent;
  }

  #tlsOf(server: BrokerServer): NatsTls {
    const named = isIP(server.hostname) === 0;
    return named ? { servername: server.hostname } : {};
  }

  #failureOf(error: unknown): Failure {
    const detail = error instanceof Error ? error.message : String(error);

    if (error instanceof errors.AuthorizationError)
      return { kind: "unauthenticated", detail };

    return { kind: "unreachable", detail };
  }
}
