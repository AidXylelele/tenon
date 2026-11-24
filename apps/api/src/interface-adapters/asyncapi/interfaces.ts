import type {
  AsyncApiInboundMessage,
  AsyncApiRequest,
  Failure,
  JsonObject,
  JsonValue,
} from "interpreter";
import type { PasswordCredentials } from "../auth/interfaces.js";

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
  BrokerTarget | { readonly kind: "unusable"; readonly detail: string };

export interface BrokerMessage {
  readonly payload: JsonValue;
  readonly contentType: string;
  readonly headers: JsonObject;
  readonly idempotencyKey: string;
  readonly login: PasswordCredentials | null;
}

export interface BrokerInbox {
  readonly subscriber: string;
  readonly ended: AbortSignal;
  demanded(): Promise<void>;
  deliver(message: AsyncApiInboundMessage): Promise<void>;
  refuse(detail: string): Promise<void>;
  lost(): void;
}

export interface BrokerSubscription {
  close(): Promise<void>;
}

export type Subscribed =
  | {
      readonly kind: "subscribed";
      readonly subscription: BrokerSubscription;
    }
  | Failure;

export interface AsyncApiInbox {
  readonly ended: AbortSignal;
  demanded(): Promise<void>;
  message(message: AsyncApiInboundMessage): Promise<void>;
  failure(failure: Failure): Promise<void>;
  lost(): void;
}

export interface Receiver {
  readonly instanceId: string;
  readonly execution: string;
  readonly request: AsyncApiRequest;
  readonly closesAt: number | null;
}

export abstract class AsyncApiDocuments {
  abstract targetOf(text: string, request: AsyncApiRequest): Promise<Targeted>;
}

export abstract class BrokerClient {
  abstract publish(
    target: BrokerTarget,
    message: BrokerMessage,
    signal: AbortSignal,
  ): Promise<void>;
  abstract subscribe(
    target: BrokerTarget,
    login: PasswordCredentials | null,
    inbox: BrokerInbox,
  ): Promise<BrokerSubscription>;
}
