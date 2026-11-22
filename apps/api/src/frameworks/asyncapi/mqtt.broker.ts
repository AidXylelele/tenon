import { isIP } from "node:net";
import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { context, propagation } from "@opentelemetry/api";
import type { AsyncApiOutcome, Failure } from "interpreter";
import {
  type AckHandler,
  connectAsync,
  type IClientPublishOptions,
  type IPublishPacket,
  type MqttClient,
} from "mqtt";
import type { Subscribed } from "../../interface-adapters/messaging/interfaces.js";
import { AddressPolicy } from "../http-client/address-policy.js";
import { MQTT_OPERATION } from "./bindings.schema.js";
import { BrokerConnections } from "./broker-connections.js";
import type {
  BrokerCredentials,
  BrokerMessage,
  BrokerInbox,
  BrokerClient,
  BrokerServer,
  BrokerTarget,
  Lost,
  MqttBinding,
  MqttVersion,
  ReceivedBrokerMessage,
} from "./interfaces.js";

@Injectable()
export class MqttBroker implements BrokerClient, OnApplicationShutdown {
  private static readonly PORT = 1883;
  private static readonly SECURE_PORT = 8883;
  private static readonly RECONNECT_MS = 1_000;
  private static readonly FORCED = true;
  private static readonly VERSION_5: MqttVersion = 5;
  private static readonly VERSION_3_1_1: MqttVersion = 4;
  private static readonly REFUSED_LOGINS = [4, 5, 134, 135];
  private static readonly AT_MOST_ONCE = 0;
  private static readonly SUCCESS = 0;
  private static readonly UNREAD_BINDING: Failure = {
    kind: "misconfigured",
    detail: "The operation's mqtt binding is not one the host reads",
  };

  readonly system = "mqtt";
  private readonly connections: BrokerConnections<MqttClient>;

  constructor(addresses: AddressPolicy) {
    this.connections = new BrokerConnections(addresses, (client) =>
      client.endAsync(MqttBroker.FORCED),
    );
  }

  async publish(
    target: BrokerTarget,
    message: BrokerMessage,
    credentials: BrokerCredentials,
  ): Promise<AsyncApiOutcome> {
    const version = this.#versionOf(target.server);
    const headed = Object.keys(message.headers).length > 0;
    const declared = target.bindings.operation.mqtt ?? {};
    const binding = MQTT_OPERATION.safeParse(declared);

    if (headed && version !== MqttBroker.VERSION_5)
      return {
        kind: "misconfigured",
        detail: "MQTT 3.1.1 carries no headers; name protocolVersion 5",
      };

    if (!binding.success) return MqttBroker.UNREAD_BINDING;

    try {
      const client = await this.connections.of(
        target.server,
        credentials,
        (address, lost) =>
          this.#connected(target.server, address, credentials, lost),
      );
      const options = this.#optionsOf(binding.data, message, version);
      await client.publishAsync(target.address, message.body, options);
      return { kind: "published" };
    } catch (error) {
      return this.#failureOf(error);
    }
  }

  async subscribe(
    target: BrokerTarget,
    credentials: BrokerCredentials,
    inbox: BrokerInbox,
  ): Promise<Subscribed> {
    const declared = target.bindings.operation.mqtt ?? {};
    const binding = MQTT_OPERATION.safeParse(declared);

    if (!binding.success) return MqttBroker.UNREAD_BINDING;

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
      const client = await this.connections.dedicated(
        target.server,
        (address) =>
          this.#connected(target.server, address, credentials, lost, acked),
      );
      const subscription = { close: () => client.endAsync() };
      client.on("message", (_topic, payload, packet) => {
        if (packet.qos !== MqttBroker.AT_MOST_ONCE) return;

        this.#delivered(payload, packet, inbox);
      });
      await client
        .subscribeAsync(target.address, { qos: binding.data.qos })
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

  onApplicationShutdown(): Promise<void> {
    return this.connections.close();
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

  async #connected(
    server: BrokerServer,
    address: string,
    credentials: BrokerCredentials,
    lost: Lost,
    acked?: AckHandler,
  ): Promise<MqttClient> {
    const scheme = server.secure ? "mqtts" : "mqtt";
    const host = isIP(address) === 6 ? `[${address}]` : address;
    const defaultPort = server.secure
      ? MqttBroker.SECURE_PORT
      : MqttBroker.PORT;
    const port = server.port ?? defaultPort;
    const url = `${scheme}://${host}:${String(port)}`;
    const login = credentials.kind === "password" ? credentials : null;
    const named = isIP(server.hostname) === 0;
    const options = {
      servername: named ? server.hostname : undefined,
      protocolVersion: this.#versionOf(server),
      username: login?.username,
      password: login?.password,
      connectTimeout: BrokerConnections.CONNECT_MS,
      reconnectPeriod: MqttBroker.RECONNECT_MS,
      resubscribe: true,
      customHandleAcks: acked,
    };
    const client = await connectAsync(url, options, false);
    client.on("error", () => undefined);
    client.on("end", lost);
    return client;
  }

  #optionsOf(
    binding: MqttBinding,
    message: BrokerMessage,
    version: MqttVersion,
  ): IClientPublishOptions {
    const qos = binding.qos;
    const retain = binding.retain;

    if (version !== MqttBroker.VERSION_5) return { qos, retain };

    const userProperties: Record<string, string> = {};

    for (const [name, value] of Object.entries(message.headers))
      userProperties[name] =
        typeof value === "string" ? value : JSON.stringify(value);

    const active = context.active();
    propagation.inject(active, userProperties);
    const contentType = message.contentType;
    return { qos, retain, properties: { contentType, userProperties } };
  }

  #headersOf(
    properties: Readonly<Record<string, string | string[]>> | undefined,
  ): Record<string, string> {
    const received = properties ?? {};
    const headers: Record<string, string> = {};

    for (const [name, value] of Object.entries(received))
      headers[name] = Array.isArray(value) ? value.join(",") : value;

    return headers;
  }

  #versionOf(server: BrokerServer): MqttVersion {
    const five =
      server.protocol === "mqtt5" ||
      (server.protocolVersion?.startsWith("5") ?? false);
    return five ? MqttBroker.VERSION_5 : MqttBroker.VERSION_3_1_1;
  }

  #failureOf(error: unknown): Failure {
    const code: unknown =
      error instanceof Error ? Reflect.get(error, "code") : undefined;
    const detail = error instanceof Error ? error.message : String(error);
    const refused =
      typeof code === "number" && MqttBroker.REFUSED_LOGINS.includes(code);

    if (refused) return { kind: "unauthenticated", detail };

    return { kind: "unreachable", detail };
  }
}
