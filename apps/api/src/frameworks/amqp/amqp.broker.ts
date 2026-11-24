import { Injectable } from "@nestjs/common";
import type { Channel, ConfirmChannel, ConsumeMessage, Options } from "amqplib";
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
  ReceivedBrokerMessage,
} from "../asyncapi/interfaces.js";
import { AMQP_CHANNEL } from "./amqp-binding.schema.js";
import { AmqpConnection } from "./amqp.connection.js";
import type { AmqpBinding } from "./interfaces.js";

@Injectable()
export class AmqpBroker implements Broker {
  private static readonly QUEUE_PREFIX = "tenon.";
  private static readonly QUEUE_EXPIRES_MS = 15 * 60 * 1000;
  private static readonly REFUSED_LOGIN = "ACCESS_REFUSED";
  private static readonly UNREAD_BINDING =
    "The channel's amqp binding is not one the host reads";

  constructor(private readonly amqp: AmqpConnection) {}

  async publish(target: BrokerTarget, message: EncodedMessage): Promise<void> {
    const binding = this.#bindingOf(target);

    try {
      const channel = await this.amqp.channelOf(target.server, message.login);
      this.#sent(channel, binding, target.address, message);
      await channel.waitForConfirms();
    } catch (error) {
      throw this.#faultOf(error);
    }
  }

  async subscribe(
    target: BrokerTarget,
    login: PasswordCredentials | null,
    inbox: EncodedInbox,
  ): Promise<BrokerSubscription> {
    const binding = this.#bindingOf(target);

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
      return { close: () => model.close() };
    } catch (error) {
      throw this.#faultOf(error);
    }
  }

  #bindingOf(target: BrokerTarget): AmqpBinding {
    const declared = target.bindings.channel.amqp ?? {};
    const binding = AMQP_CHANNEL.safeParse(declared);

    if (!binding.success)
      throw new TransportFault(
        TransportFailure.Misconfigured,
        AmqpBroker.UNREAD_BINDING,
      );

    return binding.data;
  }

  #sent(
    channel: ConfirmChannel,
    binding: AmqpBinding,
    address: string,
    message: EncodedMessage,
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
    inbox: EncodedInbox,
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
    inbox: EncodedInbox,
  ): Promise<string> {
    const exchange = this.#exchangeOf(binding);

    if (exchange === null) return binding.queue.name ?? address;

    const name = `${AmqpBroker.QUEUE_PREFIX}${inbox.subscriber}`;
    const options = { durable: true, expires: AmqpBroker.QUEUE_EXPIRES_MS };
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

  #faultOf(error: unknown): TransportFault {
    const detail = error instanceof Error ? error.message : String(error);
    const refusedLogin = detail.includes(AmqpBroker.REFUSED_LOGIN);
    const reason = refusedLogin
      ? TransportFailure.Unauthenticated
      : TransportFailure.Unreachable;
    return new TransportFault(reason, detail);
  }
}
