import type {
  AsyncApiOutcome,
  AuthenticationScheme,
  Failure,
  JsonObject,
  ResolvedAuthentication,
  RevealedAuthorization,
} from "interpreter";
import type { z } from "zod";
import type { BrokerServer } from "../../../frameworks/network/interfaces.js";
import type { Subscribed } from "../../messaging/interfaces.js";
import type { StepCall } from "../interfaces.js";
import type {
  AMQP_CHANNEL,
  MQTT_OPERATION,
} from "./asyncapi-bindings.schema.js";

export interface CallContext extends StepCall {
  readonly remaining: number | null;
}

export type Credentials = ResolvedAuthentication & {
  readonly kind: Exclude<AuthenticationScheme, "digest">;
};

export type OAuth2Credentials = Extract<
  Credentials,
  { readonly kind: "oauth2" | "oidc" }
>;

export interface PasswordCredentials {
  readonly username: string;
  readonly password: string;
}

export type UnusableSecret = Extract<
  Failure,
  { readonly kind: "forbidden" | "misconfigured" }
>;

export type Authorization =
  | { readonly kind: "anonymous" }
  | { readonly kind: "header"; readonly header: RevealedAuthorization };

export type Authorized = Authorization | UnusableSecret;

export abstract class AuthorizationServer {
  abstract accessTokenFor(
    credentials: OAuth2Credentials,
    signal: AbortSignal,
  ): Promise<string>;
}

export type BasicCredentials = Extract<Credentials, { readonly kind: "basic" }>;

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
