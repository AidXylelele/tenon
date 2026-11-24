import { Injectable } from "@nestjs/common";
import type { Channel, ConfirmChannel, ConsumeMessage, Options } from "amqplib";
import type { AsyncApiOutcome, Failure } from "interpreter";
import { AmqpConnection } from "../../../frameworks/amqp/amqp.connection.js";
import type { Subscribed } from "../../messaging/interfaces.js";
import type { BasicCredentials } from "../../auth/interfaces.js";
import { AMQP_CHANNEL } from "./asyncapi-bindings.schema.js";
import type {
  AmqpBinding,
  BrokerGateway,
  BrokerInbox,
  BrokerMessage,
  BrokerTarget,
  ReceivedBrokerMessage,
} from "./interfaces.js";

@Injectable()
export class AmqpGateway implements BrokerGateway {
  private static readonly QUEUE_PREFIX = "tenon.";
  private static readonly QUEUE_EXPIRES_MS = 15 * 60 * 1000;
  private static readonly REFUSED_LOGIN = "ACCESS_REFUSED";
  private static readonly UNREAD_BINDING: Failure = {
    kind: "misconfigured",
    detail: "The channel's amqp binding is not one the host reads",
  };

  constructor(private readonly amqp: AmqpConnection) {}

  async publish(
    target: BrokerTarget,
    message: BrokerMessage,
  ): Promise<AsyncApiOutcome> {
    const binding = this.#bindingOf(target);

    if (binding === null) return AmqpGateway.UNREAD_BINDING;

    try {
      const channel = await this.amqp.channelOf(target.server, message.login);
      this.#sent(channel, binding, target.address, message);
      await channel.waitForConfirms();
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
    const binding = this.#bindingOf(target);

    if (binding === null) return AmqpGateway.UNREAD_BINDING;

    const exchange = this.#exchangeOf(binding);
    const shared = exchange === null;
    const lost = () => {
      inbox.lost();
    };
    const declare = (channel: Channel) =>
      this.#queueOf(channel, binding, target.address, inbox);
    const handle = (channel: Channel, message: ConsumeMessage) => {
      void this.#handled(channel, message, inbox, shared).catch(lost);
    };

    try {
      const model = await this.amqp.consume(
        target.server,
        login,
        declare,
        handle,
        lost,
      );
      const subscription = { close: () => model.close() };
      return { kind: "subscribed", subscription };
    } catch (error) {
      return this.#failureOf(error);
    }
  }

  #bindingOf(target: BrokerTarget): AmqpBinding | null {
    const declared = target.bindings.channel.amqp ?? {};
    const binding = AMQP_CHANNEL.safeParse(declared);

    if (!binding.success) return null;

    return binding.data;
  }

  #sent(
    channel: ConfirmChannel,
    binding: AmqpBinding,
    address: string,
    message: BrokerMessage,
  ): void {
    const options: Options.Publish = {
      headers: { ...message.headers },
      messageId: message.idempotencyKey,
      contentType: message.contentType,
      persistent: true,
    };
    const exchange = this.#exchangeOf(binding);

    if (exchange !== null) {
      channel.publish(exchange, address, message.body, options);
      return;
    }

    const queue = binding.queue.name ?? address;
    channel.sendToQueue(queue, message.body, options);
  }

  async #handled(
    channel: Channel,
    message: ConsumeMessage,
    inbox: BrokerInbox,
    shared: boolean,
  ): Promise<void> {
    try {
      if (shared) await inbox.demanded();

      const received = this.#receivedOf(message);
      await inbox.deliver(received);
      channel.ack(message);
    } catch {
      if (!inbox.ended.aborted) channel.nack(message);
    }
  }

  #receivedOf(message: ConsumeMessage): ReceivedBrokerMessage {
    const properties = message.properties;
    return {
      body: message.content,
      contentType: this.#textOf(properties.contentType),
      headers: properties.headers ?? {},
      correlationId: this.#textOf(properties.correlationId),
    };
  }

  async #queueOf(
    channel: Channel,
    binding: AmqpBinding,
    address: string,
    inbox: BrokerInbox,
  ): Promise<string> {
    const exchange = this.#exchangeOf(binding);

    if (exchange === null) return binding.queue.name ?? address;

    const name = `${AmqpGateway.QUEUE_PREFIX}${inbox.subscriber}`;
    const options = { durable: true, expires: AmqpGateway.QUEUE_EXPIRES_MS };
    await channel.assertQueue(name, options);
    await channel.bindQueue(name, exchange, address);
    return name;
  }

  #exchangeOf(binding: AmqpBinding): string | null {
    const exchange = binding.exchange.name;

    if (binding.is !== "routingKey" || exchange === undefined) return null;

    return exchange;
  }

  #textOf(value: unknown): string | null {
    return typeof value === "string" ? value : null;
  }

  #failureOf(error: unknown): Failure {
    const detail = error instanceof Error ? error.message : String(error);
    const refusedLogin = detail.includes(AmqpGateway.REFUSED_LOGIN);

    if (refusedLogin) return { kind: "unauthenticated", detail };

    return { kind: "unreachable", detail };
  }
}
