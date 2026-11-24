import { Injectable } from "@nestjs/common";
import type { AsyncApiOutcome, Failure } from "interpreter";
import { ErrorReply } from "redis";
import { RedisConnection } from "../../../frameworks/redis/redis.connection.js";
import type { Subscribed } from "../../messaging/interfaces.js";
import type { BasicCredentials } from "../../auth/interfaces.js";
import type {
  BrokerGateway,
  BrokerInbox,
  BrokerMessage,
  BrokerTarget,
} from "./interfaces.js";

@Injectable()
export class RedisGateway implements BrokerGateway {
  private static readonly REFUSED_LOGINS = /^(WRONGPASS|NOAUTH|NOPERM)/;

  constructor(private readonly redis: RedisConnection) {}

  async publish(
    target: BrokerTarget,
    message: BrokerMessage,
    signal: AbortSignal,
  ): Promise<AsyncApiOutcome> {
    const headed = Object.keys(message.headers).length > 0;

    if (headed)
      return {
        kind: "misconfigured",
        detail: "A Redis channel carries no headers",
      };

    try {
      const client = await this.redis.clientOf(target.server, message.login);
      const abortable = client.withAbortSignal(signal);
      await abortable.publish(target.address, message.body);
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

  #failureOf(error: unknown): Failure {
    const detail = error instanceof Error ? error.message : String(error);
    const refused =
      error instanceof ErrorReply && RedisGateway.REFUSED_LOGINS.test(detail);

    if (refused) return { kind: "unauthenticated", detail };

    return { kind: "unreachable", detail };
  }
}
