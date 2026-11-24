import { Injectable } from "@nestjs/common";
import { AuthenticationError } from "@platformatic/kafka";
import type { AsyncApiOutcome, Failure } from "interpreter";
import type { KafkaStream } from "../../../frameworks/kafka/interfaces.js";
import { KafkaConnection } from "../../../frameworks/kafka/kafka.connection.js";
import type { Subscribed } from "../../messaging/interfaces.js";
import { KAFKA_CHANNEL } from "./asyncapi-bindings.schema.js";
import type { BasicCredentials } from "../../auth/interfaces.js";
import type {
  BrokerGateway,
  BrokerInbox,
  BrokerMessage,
  BrokerTarget,
} from "./interfaces.js";

@Injectable()
export class KafkaGateway implements BrokerGateway {
  private static readonly CONTENT_TYPE = "content-type";
  private static readonly TOMBSTONE = Buffer.alloc(0);
  private static readonly UNREAD_BINDING: Failure = {
    kind: "misconfigured",
    detail: "The channel's kafka binding is not one the host reads",
  };

  constructor(private readonly kafka: KafkaConnection) {}

  async publish(
    target: BrokerTarget,
    message: BrokerMessage,
  ): Promise<AsyncApiOutcome> {
    const topic = this.#topicOf(target);

    if (topic === null) return KafkaGateway.UNREAD_BINDING;

    const headers = this.#headersOf(message);
    const record = { topic, value: message.body, headers };

    try {
      await this.kafka.send(target.server, message.login, record);
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
    const topic = this.#topicOf(target);

    if (topic === null) return KafkaGateway.UNREAD_BINDING;

    const lost = () => {
      inbox.lost();
    };

    try {
      const stream = await this.kafka.consume(
        target.server,
        login,
        inbox.subscriber,
        topic,
        lost,
      );
      const subscription = { close: () => stream.consumer.close(true) };
      void this.#consumed(stream, inbox).then(lost, lost);
      return { kind: "subscribed", subscription };
    } catch (error) {
      return this.#failureOf(error);
    }
  }

  async #consumed(stream: KafkaStream, inbox: BrokerInbox): Promise<void> {
    for await (const message of stream) {
      const headers = Object.fromEntries(message.headers);
      const contentType = headers[KafkaGateway.CONTENT_TYPE] ?? null;
      const body = message.value ?? KafkaGateway.TOMBSTONE;
      const received = { body, contentType, headers, correlationId: null };
      await inbox.deliver(received);
      await message.commit();
    }
  }

  #topicOf(target: BrokerTarget): string | null {
    const declared = target.bindings.channel.kafka ?? {};
    const binding = KAFKA_CHANNEL.safeParse(declared);

    if (!binding.success) return null;

    return binding.data.topic ?? target.address;
  }

  #headersOf(message: BrokerMessage): Record<string, string> {
    const headers: Record<string, string> = {
      [KafkaGateway.CONTENT_TYPE]: message.contentType,
    };

    for (const [name, value] of Object.entries(message.headers))
      headers[name] = typeof value === "string" ? value : JSON.stringify(value);

    return headers;
  }

  #failureOf(error: unknown): Failure {
    const detail = error instanceof Error ? error.message : String(error);

    if (error instanceof AuthenticationError)
      return { kind: "unauthenticated", detail };

    return { kind: "unreachable", detail };
  }
}
