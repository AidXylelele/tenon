import type {
  AsyncApiOutcome,
  Failure,
  JsonObject,
  JsonValue,
  ProcessOutcome,
} from "interpreter";
import type { z } from "zod";
import type { BrokerServer } from "../../../frameworks/asyncapi/interfaces.js";
import type { Subscribed } from "../../messaging/interfaces.js";
import type { BasicCredentials } from "../../auth/interfaces.js";
import type { StepCall } from "../interfaces.js";
import type {
  AMQP_CHANNEL,
  MQTT_OPERATION,
} from "./asyncapi-bindings.schema.js";

export interface CallContext extends StepCall {
  readonly remaining: number | null;
}

export interface SandboxLimitsProps {
  readonly time: Temporal.Duration;
  readonly memoryBytes: number;
  readonly processes: number;
  readonly outputBytes: number;
}

export interface ScriptLanguage {
  readonly interpreter: string;
  declares(name: string): boolean;
  declarationOf(name: string, value: JsonValue): string;
}

export interface SandboxFile {
  readonly content?: string;
  readonly name?: string;
  readonly max?: number;
}

export interface SandboxCommand {
  readonly args: readonly string[];
  readonly env: readonly string[];
  readonly files: readonly SandboxFile[];
  readonly cpuLimit: number;
  readonly clockLimit: number;
  readonly memoryLimit: number;
  readonly procLimit: number;
  readonly copyIn: Readonly<Record<string, SandboxFile>>;
}

export type BuiltCommand =
  | { readonly kind: "command"; readonly command: SandboxCommand }
  | ProcessOutcome;

export interface AsyncApiServer extends BrokerServer {
  readonly protocol: string;
  readonly protocolVersion: string | null;
}

interface BrokerBindings {
  readonly channel: Readonly<Record<string, unknown>>;
  readonly operation: Readonly<Record<string, unknown>>;
}

export interface BrokerTarget {
  readonly kind: "target";
  readonly server: AsyncApiServer;
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
  readonly login: BasicCredentials | null;
}

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

export interface BrokerGateway {
  publish(
    target: BrokerTarget,
    message: BrokerMessage,
    signal: AbortSignal,
  ): Promise<AsyncApiOutcome>;
  subscribe(
    target: BrokerTarget,
    login: BasicCredentials | null,
    inbox: BrokerInbox,
  ): Promise<Subscribed>;
}

export type AmqpBinding = z.infer<typeof AMQP_CHANNEL>;

export type MqttBinding = z.infer<typeof MQTT_OPERATION>;
