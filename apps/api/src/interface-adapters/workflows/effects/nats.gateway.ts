import { Injectable } from "@nestjs/common";
import {
  errors,
  headers,
  type Msg,
  type MsgHdrs,
  type NatsConnection as NatsClient,
} from "@nats-io/transport-node";
import type { AsyncApiOutcome, Failure } from "interpreter";
import { NatsConnection } from "../../../frameworks/nats/nats.connection.js";
import type { Subscribed } from "../../messaging/interfaces.js";
import type {
  BasicCredentials,
  BrokerGateway,
  BrokerInbox,
  BrokerMessage,
  BrokerTarget,
} from "./interfaces.js";

@Injectable()
export class NatsGateway implements BrokerGateway {
  private static readonly MESSAGE_ID = "Nats-Msg-Id";

  constructor(private readonly nats: NatsConnection) {}

  async publish(
    target: BrokerTarget,
    message: BrokerMessage,
  ): Promise<AsyncApiOutcome> {
    try {
      const client = await this.nats.clientOf(target.server, message.login);
      const sent = this.#headersOf(message);
      client.publish(target.address, message.body, { headers: sent });
      await client.flush();
      return { kind: "published" };
    } catch (error) {
      return this.#failureOf(error);
    }
  }

  async subscribe(
    target: BrokerTarget,
    login: BasicCredentials | null,
    inbox: BrokerInbox,
  ): Promise<Subscribed> {
    const lost = () => {
      inbox.lost();
    };

    try {
      const client = await this.nats.subscriberOf(target.server, login, lost);
      const subscription = { close: () => client.close() };
      await this.#consumed(client, target.address, inbox).catch(
        async (error: unknown) => {
          const closed = subscription.close();
          await Promise.allSettled([closed]);
          throw error;
        },
      );
      return { kind: "subscribed", subscription };
    } catch (error) {
      return this.#failureOf(error);
    }
  }

  async #consumed(
    client: NatsClient,
    subject: string,
    inbox: BrokerInbox,
  ): Promise<void> {
    client.subscribe(subject, {
      callback: (error, message) => {
        if (error !== null) {
          inbox.lost();
          return;
        }

        this.#delivered(message, inbox);
      },
    });
    await client.flush();
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

    sent.set(NatsGateway.MESSAGE_ID, message.idempotencyKey);
    return sent;
  }

  #failureOf(error: unknown): Failure {
    const detail = error instanceof Error ? error.message : String(error);

    if (error instanceof errors.AuthorizationError)
      return { kind: "unauthenticated", detail };

    return { kind: "unreachable", detail };
  }
}
