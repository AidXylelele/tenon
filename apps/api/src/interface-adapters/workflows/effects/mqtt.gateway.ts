import { Injectable } from "@nestjs/common";
import type { AsyncApiOutcome, Failure } from "interpreter";
import type { AckHandler, IClientPublishOptions, IPublishPacket } from "mqtt";
import type { MqttVersion } from "../../../frameworks/mqtt/interfaces.js";
import { MqttConnection } from "../../../frameworks/mqtt/mqtt.connection.js";
import type { Subscribed } from "../../messaging/interfaces.js";
import { MQTT_OPERATION } from "./asyncapi-bindings.schema.js";
import type {
  BasicCredentials,
  BrokerGateway,
  BrokerInbox,
  BrokerMessage,
  BrokerTarget,
  MqttBinding,
  ReceivedBrokerMessage,
} from "./interfaces.js";

@Injectable()
export class MqttGateway implements BrokerGateway {
  private static readonly VERSION_5: MqttVersion = 5;
  private static readonly VERSION_3_1_1: MqttVersion = 4;
  private static readonly REFUSED_LOGINS = [4, 5, 134, 135];
  private static readonly AT_MOST_ONCE = 0;
  private static readonly SUCCESS = 0;
  private static readonly UNREAD_BINDING: Failure = {
    kind: "misconfigured",
    detail: "The operation's mqtt binding is not one the host reads",
  };

  constructor(private readonly mqtt: MqttConnection) {}

  async publish(
    target: BrokerTarget,
    message: BrokerMessage,
  ): Promise<AsyncApiOutcome> {
    const version = this.#versionOf(target);
    const headed = Object.keys(message.headers).length > 0;
    const binding = this.#bindingOf(target);

    if (headed && version !== MqttGateway.VERSION_5)
      return {
        kind: "misconfigured",
        detail: "MQTT 3.1.1 carries no headers; name protocolVersion 5",
      };

    if (binding === null) return MqttGateway.UNREAD_BINDING;

    try {
      const client = await this.mqtt.clientOf(
        target.server,
        message.login,
        version,
      );
      const options = this.#optionsOf(binding, message, version);
      await client.publishAsync(target.address, message.body, options);
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

    if (binding === null) return MqttGateway.UNREAD_BINDING;

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
        if (packet.qos !== MqttGateway.AT_MOST_ONCE) return;

        this.#delivered(payload, packet, inbox);
      });
      await client
        .subscribeAsync(target.address, { qos: binding.qos })
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

  #acked(
    payload: Buffer,
    packet: IPublishPacket,
    inbox: BrokerInbox,
    done: Parameters<AckHandler>[3],
  ): void {
    const received = this.#receivedOf(payload, packet);
    inbox.deliver(received).then(
      () => {
        done(MqttGateway.SUCCESS);
      },
      () => {
        inbox.lost();
      },
    );
  }

  #delivered(
    payload: Buffer,
    packet: IPublishPacket,
    inbox: BrokerInbox,
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

  #bindingOf(target: BrokerTarget): MqttBinding | null {
    const declared = target.bindings.operation.mqtt ?? {};
    const binding = MQTT_OPERATION.safeParse(declared);

    if (!binding.success) return null;

    return binding.data;
  }

  #optionsOf(
    binding: MqttBinding,
    message: BrokerMessage,
    version: MqttVersion,
  ): IClientPublishOptions {
    const qos = binding.qos;
    const retain = binding.retain;

    if (version !== MqttGateway.VERSION_5) return { qos, retain };

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
    return five ? MqttGateway.VERSION_5 : MqttGateway.VERSION_3_1_1;
  }

  #failureOf(error: unknown): Failure {
    const code: unknown =
      error instanceof Error ? Reflect.get(error, "code") : undefined;
    const detail = error instanceof Error ? error.message : String(error);
    const refused =
      typeof code === "number" && MqttGateway.REFUSED_LOGINS.includes(code);

    if (refused) return { kind: "unauthenticated", detail };

    return { kind: "unreachable", detail };
  }
}
