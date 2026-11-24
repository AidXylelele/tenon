import { Injectable } from "@nestjs/common";
import { AuthenticationError } from "@platformatic/kafka";
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
import type { KafkaStream } from "./interfaces.js";
import { KAFKA_CHANNEL } from "./kafka-binding.schema.js";
import { KafkaConnection } from "./kafka.connection.js";

@Injectable()
export class KafkaBroker implements Broker {
  private static readonly CONTENT_TYPE = "content-type";
  private static readonly TOMBSTONE = Buffer.alloc(0);
  private static readonly UNREAD_BINDING =
    "The channel's kafka binding is not one the host reads";

  constructor(private readonly kafka: KafkaConnection) {}

  async publish(target: BrokerTarget, message: EncodedMessage): Promise<void> {
    const topic = this.#topicOf(target);
    const headers = this.#headersOf(message);
    const record = { topic, value: message.body, headers };

    try {
      await this.kafka.send(target.server, message.login, record);
    } catch (error) {
      throw this.#faultOf(error);
    }
  }

  async subscribe(
    target: BrokerTarget,
    login: PasswordCredentials | null,
    inbox: EncodedInbox,
  ): Promise<BrokerSubscription> {
    const topic = this.#topicOf(target);

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
      void this.#consumed(stream, inbox).then(lost, lost);
      return { close: () => stream.consumer.close(true) };
    } catch (error) {
      throw this.#faultOf(error);
    }
  }

  async #consumed(stream: KafkaStream, inbox: EncodedInbox): Promise<void> {
    for await (const message of stream) {
      const headers = Object.fromEntries(message.headers);
      const contentType = headers[KafkaBroker.CONTENT_TYPE] ?? null;
      const body = message.value ?? KafkaBroker.TOMBSTONE;
      const received = { body, contentType, headers, correlationId: null };
      await inbox.deliver(received);
      await message.commit();
    }
  }

  #topicOf(target: BrokerTarget): string {
    const declared = target.bindings.channel.kafka ?? {};
    const binding = KAFKA_CHANNEL.safeParse(declared);

    if (!binding.success)
      throw new TransportFault(
        TransportFailure.Misconfigured,
        KafkaBroker.UNREAD_BINDING,
      );

    return binding.data.topic ?? target.address;
  }

  #headersOf(message: EncodedMessage): Record<string, string> {
    const headers: Record<string, string> = {
      [KafkaBroker.CONTENT_TYPE]: message.contentType,
    };

    for (const [name, value] of Object.entries(message.headers))
      headers[name] = typeof value === "string" ? value : JSON.stringify(value);

    return headers;
  }

  #faultOf(error: unknown): TransportFault {
    const detail = error instanceof Error ? error.message : String(error);
    const reason =
      error instanceof AuthenticationError
        ? TransportFailure.Unauthenticated
        : TransportFailure.Unreachable;
    return new TransportFault(reason, detail);
  }
}
