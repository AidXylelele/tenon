import { Injectable } from "@nestjs/common";
import { ErrorReply } from "redis";
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
import { RedisConnection } from "./redis.connection.js";

@Injectable()
export class RedisBroker implements Broker {
  private static readonly REFUSED_LOGINS = /^(WRONGPASS|NOAUTH|NOPERM)/;

  constructor(private readonly redis: RedisConnection) {}

  async publish(
    target: BrokerTarget,
    message: EncodedMessage,
    signal: AbortSignal,
  ): Promise<void> {
    const headed = Object.keys(message.headers).length > 0;

    if (headed)
      throw new TransportFault(
        TransportFailure.Misconfigured,
        "A Redis channel carries no headers",
      );

    try {
      const client = await this.redis.clientOf(target.server, message.login);
      const abortable = client.withAbortSignal(signal);
      await abortable.publish(target.address, message.body);
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
    const delivered = (message: Buffer) => {
      this.#delivered(message, inbox);
    };

    try {
      const client = await this.redis.subscriberOf(target.server, login, lost);
      const subscription = { close: () => client.close() };
      await client
        .subscribe(target.address, delivered, true)
        .catch(async (error: unknown) => {
          const closed = subscription.close();
          await Promise.allSettled([closed]);
          throw error;
        });
      return subscription;
    } catch (error) {
      throw this.#faultOf(error);
    }
  }

  #delivered(body: Buffer, inbox: EncodedInbox): void {
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

  #faultOf(error: unknown): TransportFault {
    const detail = error instanceof Error ? error.message : String(error);
    const refused =
      error instanceof ErrorReply && RedisBroker.REFUSED_LOGINS.test(detail);
    const reason = refused
      ? TransportFailure.Unauthenticated
      : TransportFailure.Unreachable;
    return new TransportFault(reason, detail);
  }
}
