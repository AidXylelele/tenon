import { Injectable } from "@nestjs/common";
import {
  errors,
  headers,
  type Msg,
  type MsgHdrs,
  type NatsConnection as NatsClient,
} from "@nats-io/transport-node";
import type {
  BrokerSubscription,
  BrokerTarget,
} from "../../interface-adapters/asyncapi/interfaces.js";
import type { PasswordCredentials } from "../../interface-adapters/auth/interfaces.js";
import { TransportFailure } from "../../interface-adapters/http/enums.js";
import { TransportFault } from "../../interface-adapters/http/transport-fault.error.js";
import type {
  Broker,
  EncodedInbox,
  EncodedMessage,
} from "../asyncapi/interfaces.js";
import { NatsConnection } from "./nats.connection.js";

@Injectable()
export class NatsBroker implements Broker {
  private static readonly MESSAGE_ID = "Nats-Msg-Id";

  constructor(private readonly nats: NatsConnection) {}

  async publish(target: BrokerTarget, message: EncodedMessage): Promise<void> {
    try {
      const client = await this.nats.clientOf(target.server, message.login);
      const sent = this.#headersOf(message);
      client.publish(target.address, message.body, { headers: sent });
      await client.flush();
    } catch (error) {
      throw this.#faultOf(error);
    }
  }

  async subscribe(
    target: BrokerTarget,
    login: PasswordCredentials | null,
    inbox: EncodedInbox,
  ): Promise<BrokerSubscription> {
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
      return subscription;
    } catch (error) {
      throw this.#faultOf(error);
    }
  }

  async #consumed(
    client: NatsClient,
    subject: string,
    inbox: EncodedInbox,
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

  #delivered(message: Msg, inbox: EncodedInbox): void {
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

  #headersOf(message: EncodedMessage): MsgHdrs {
    const sent = headers();

    for (const [name, value] of Object.entries(message.headers)) {
      const text = typeof value === "string" ? value : JSON.stringify(value);
      sent.set(name, text);
    }

    sent.set(NatsBroker.MESSAGE_ID, message.idempotencyKey);
    return sent;
  }

  #faultOf(error: unknown): TransportFault {
    const detail = error instanceof Error ? error.message : String(error);
    const reason =
      error instanceof errors.AuthorizationError
        ? TransportFailure.Unauthenticated
        : TransportFailure.Unreachable;
    return new TransportFault(reason, detail);
  }
}
