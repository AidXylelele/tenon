import type {
  Consumer as KafkaClientConsumer,
  Producer as KafkaClientProducer,
} from "@platformatic/kafka";
import type { ConnectionOptions as TlsConnection } from "node:tls";
import type { NodeConnectionOptions } from "@nats-io/transport-node";
import type { AsyncApiOutcome, Failure, JsonObject } from "interpreter";
import type { IClientOptions } from "mqtt";
import type { RedisClientType } from "redis";
import type { z } from "zod";
import type { Subscribed } from "../../interface-adapters/messaging/interfaces.js";
import type { PasswordCredentials } from "../http-client/interfaces.js";
import type { AMQP_CHANNEL, MQTT_OPERATION } from "./bindings.schema.js";

export interface BrokerServer {
  readonly url: string;
  readonly protocol: string;
  readonly protocolVersion: string | null;
  readonly hostname: string;
  readonly port: number | null;
  readonly pathname: string;
  readonly secure: boolean;
}

interface BrokerBindings {
  readonly channel: Readonly<Record<string, unknown>>;
  readonly operation: Readonly<Record<string, unknown>>;
}

export interface BrokerTarget {
  readonly kind: "target";
  readonly server: BrokerServer;
  readonly address: string;
  readonly contentType: string;
  readonly bindings: BrokerBindings;
}

export type Targeted =
  BrokerTarget | Extract<Failure, { readonly kind: "misconfigured" }>;

export type Expired = Extract<Failure, { readonly kind: "expired" }>;

export interface BrokerMessage {
  readonly body: Buffer;
  readonly contentType: string;
  readonly headers: JsonObject;
  readonly idempotencyKey: string;
}

export type BrokerCredentials =
  | { readonly kind: "anonymous" }
  | ({ readonly kind: "password" } & PasswordCredentials);

export interface ReceivedBrokerMessage {
  readonly body: Buffer;
  readonly contentType: string | null;
  readonly headers: JsonObject;
  readonly correlationId: string | null;
}

export interface BrokerInbox {
  readonly subscriber: string;
  readonly ended: AbortSignal;
  demanded(): Promise<void>;
  deliver(message: ReceivedBrokerMessage): Promise<void>;
  lost(): void;
}

export interface BrokerClient {
  readonly system: string;
  publish(
    target: BrokerTarget,
    message: BrokerMessage,
    credentials: BrokerCredentials,
    signal: AbortSignal,
  ): Promise<AsyncApiOutcome>;
  subscribe(
    target: BrokerTarget,
    credentials: BrokerCredentials,
    inbox: BrokerInbox,
  ): Promise<Subscribed>;
}

export type Lost = () => void;

export interface Opening<C> {
  readonly server: BrokerServer;
  open(address: string, lost: Lost): Promise<C>;
}

export type MqttVersion = NonNullable<IClientOptions["protocolVersion"]>;

export type RedisConnection = RedisClientType;

export type AmqpBinding = z.infer<typeof AMQP_CHANNEL>;

export interface AmqpQueue {
  readonly name: string;
  readonly shared: boolean;
}

export type MqttBinding = z.infer<typeof MQTT_OPERATION>;

export type KafkaProducer = KafkaClientProducer<Buffer, Buffer, string, string>;

export type KafkaConsumer = KafkaClientConsumer<Buffer, Buffer, string, string>;

export type NatsTls = NonNullable<NodeConnectionOptions["tls"]> &
  Pick<TlsConnection, "servername">;
