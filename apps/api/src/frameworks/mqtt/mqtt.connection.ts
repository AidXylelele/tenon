import { isIP } from "node:net";
import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { type AckHandler, connectAsync, type MqttClient } from "mqtt";
import { AddressPolicy } from "../http/address-policy.js";
import { BrokerConnections } from "../asyncapi/broker-connections.js";
import type { BrokerServer } from "../../interface-adapters/asyncapi/interfaces.js";
import type { PasswordCredentials } from "../../interface-adapters/auth/interfaces.js";
import type { Lost } from "../asyncapi/interfaces.js";
import type { MqttVersion } from "./interfaces.js";

@Injectable()
export class MqttConnection implements OnApplicationShutdown {
  private static readonly PORT = 1883;
  private static readonly SECURE_PORT = 8883;
  private static readonly RECONNECT_MS = 1_000;
  private static readonly FORCED = true;

  private readonly connections: BrokerConnections<MqttClient>;

  constructor(addresses: AddressPolicy) {
    this.connections = new BrokerConnections(addresses, (client) =>
      client.endAsync(MqttConnection.FORCED),
    );
  }

  clientOf(
    server: BrokerServer,
    login: PasswordCredentials | null,
    version: MqttVersion,
  ): Promise<MqttClient> {
    const variant = String(version);
    return this.connections.of(server, variant, login, (address, lost) =>
      this.#connected(server, address, login, version, lost),
    );
  }

  subscriberOf(
    server: BrokerServer,
    login: PasswordCredentials | null,
    version: MqttVersion,
    acked: AckHandler,
    lost: Lost,
  ): Promise<MqttClient> {
    return this.connections.dedicated(server, (address) =>
      this.#connected(server, address, login, version, lost, acked),
    );
  }

  onApplicationShutdown(): Promise<void> {
    return this.connections.close();
  }

  async #connected(
    server: BrokerServer,
    address: string,
    login: PasswordCredentials | null,
    version: MqttVersion,
    lost: Lost,
    acked?: AckHandler,
  ): Promise<MqttClient> {
    const scheme = server.secure ? "mqtts" : "mqtt";
    const ipv6 = isIP(address) === 6;
    const host = ipv6 ? `[${address}]` : address;
    const defaultPort = server.secure
      ? MqttConnection.SECURE_PORT
      : MqttConnection.PORT;
    const port = server.port ?? defaultPort;
    const url = `${scheme}://${host}:${String(port)}`;
    const named = isIP(server.hostname) === 0;
    const options = {
      servername: named ? server.hostname : undefined,
      protocolVersion: version,
      username: login?.username,
      password: login?.password,
      connectTimeout: BrokerConnections.CONNECT_MS,
      reconnectPeriod: MqttConnection.RECONNECT_MS,
      resubscribe: true,
      customHandleAcks: acked,
    };
    const client = await connectAsync(url, options, false);
    client.on("error", () => undefined);
    client.on("end", lost);
    return client;
  }
}
