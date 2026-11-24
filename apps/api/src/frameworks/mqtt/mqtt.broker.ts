import { Injectable } from "@nestjs/common";
import type { AckHandler, IClientPublishOptions, IPublishPacket } from "mqtt";
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
import type { MqttBinding, MqttVersion } from "./interfaces.js";
import { MQTT_OPERATION } from "./mqtt-binding.schema.js";
import { MqttConnection } from "./mqtt.connection.js";

@Injectable()
export class MqttBroker implements Broker {
  private static readonly VERSION_5: MqttVersion = 5;
  private static readonly VERSION_3_1_1: MqttVersion = 4;
  private static readonly REFUSED_LOGINS = [4, 5, 134, 135];
  private static readonly AT_MOST_ONCE = 0;
  private static readonly SUCCESS = 0;
  private static readonly UNREAD_BINDING =
    "The operation's mqtt binding is not one the host reads";

  constructor(private readonly mqtt: MqttConnection) {}

  async publish(target: BrokerTarget, message: EncodedMessage): Promise<void> {
    const version = this.#versionOf(target);
    const headed = Object.keys(message.headers).length > 0;

    if (headed && version !== MqttBroker.VERSION_5)
      throw this.#misconfigured(
        "MQTT 3.1.1 carries no headers; name protocolVersion 5",
      );

    const binding = this.#bindingOf(target);

    try {
      const client = await this.mqtt.clientOf(
        target.server,
        message.login,
        version,
      );
      const options = this.#optionsOf(binding, message, version);
      await client.publishAsync(target.address, message.body, options);
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

    const version = this.#versionOf(target);
    const lost = () => {
      inbox.lost();
    };
    const acked: AckHandler = (
      _topic,
      payload,
      packet: IPublishPacket,
      done,
    ) => {
      this.#acked(payload, packet, inbox, done);
    };

    try {
      const client = await this.mqtt.subscriberOf(
        target.server,
        login,
        version,
        acked,
        lost,
      );
      const subscription = { close: () => client.endAsync() };
      client.on("message", (_topic, payload, packet) => {
        if (packet.qos !== MqttBroker.AT_MOST_ONCE) return;

        this.#delivered(payload, packet, inbox);
      });
      await client
        .subscribeAsync(target.address, { qos: binding.qos })
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

  #acked(
    payload: Buffer,
    packet: IPublishPacket,
    inbox: EncodedInbox,
    done: Parameters<AckHandler>[3],
  ): void {
    const received = this.#receivedOf(payload, packet);
    inbox.deliver(received).then(
      () => {
        done(MqttBroker.SUCCESS);
      },
      () => {
        inbox.lost();
      },
    );
  }

  #delivered(
    payload: Buffer,
    packet: IPublishPacket,
    inbox: EncodedInbox,
  ): void {
    const received = this.#receivedOf(payload, packet);
    inbox.deliver(received).catch(() => {
      inbox.lost();
    });
  }

  #receivedOf(payload: Buffer, packet: IPublishPacket): ReceivedBrokerMessage {
    const properties = packet.properties;
    const correlation = properties?.correlationData;
    const headers = this.#headersOf(properties?.userProperties);
    return {
      body: payload,
      contentType: properties?.contentType ?? null,
      headers,
      correlationId: correlation === undefined ? null : correlation.toString(),
    };
  }

  #bindingOf(target: BrokerTarget): MqttBinding {
    const declared = target.bindings.operation.mqtt ?? {};
    const binding = MQTT_OPERATION.safeParse(declared);

    if (!binding.success) throw this.#misconfigured(MqttBroker.UNREAD_BINDING);

    return binding.data;
  }

  #optionsOf(
    binding: MqttBinding,
    message: EncodedMessage,
    version: MqttVersion,
  ): IClientPublishOptions {
    const qos = binding.qos;
    const retain = binding.retain;

    if (version !== MqttBroker.VERSION_5) return { qos, retain };

    const userProperties: Record<string, string> = {};

    for (const [name, value] of Object.entries(message.headers))
      userProperties[name] =
        typeof value === "string" ? value : JSON.stringify(value);

    const contentType = message.contentType;
    return { qos, retain, properties: { contentType, userProperties } };
  }

  #headersOf(
    properties: Readonly<Record<string, string | string[]>> | undefined,
  ): Record<string, string> {
    const received = properties ?? {};
    const headers: Record<string, string> = {};

    for (const [name, value] of Object.entries(received)) {
      const repeated = Array.isArray(value);
      headers[name] = repeated ? value.join(",") : value;
    }

    return headers;
  }

  #versionOf(target: BrokerTarget): MqttVersion {
    const server = target.server;
    const five =
      server.protocol === "mqtt5" ||
      (server.protocolVersion?.startsWith("5") ?? false);
    return five ? MqttBroker.VERSION_5 : MqttBroker.VERSION_3_1_1;
  }

  #faultOf(error: unknown): TransportFault {
    const code: unknown =
      error instanceof Error ? Reflect.get(error, "code") : undefined;
    const detail = error instanceof Error ? error.message : String(error);
    const refused =
      typeof code === "number" && MqttBroker.REFUSED_LOGINS.includes(code);
    const reason = refused
      ? TransportFailure.Unauthenticated
      : TransportFailure.Unreachable;
    return new TransportFault(reason, detail);
  }

  #misconfigured(detail: string): TransportFault {
    return new TransportFault(TransportFailure.Misconfigured, detail);
  }
}
