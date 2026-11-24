import type { Parser } from "@asyncapi/parser";
import type { JsonObject } from "interpreter";
import type {
  BrokerServer,
  BrokerSubscription,
  BrokerTarget,
} from "../../interface-adapters/asyncapi/interfaces.js";
import type { PasswordCredentials } from "../../interface-adapters/auth/interfaces.js";

export type ParserOptions = NonNullable<
  ConstructorParameters<typeof Parser>[0]
>;

export type Lost = () => void;

export interface Opening<C> {
  readonly server: BrokerServer;
  open(address: string, lost: Lost): Promise<C>;
}

export interface EncodedMessage {
  readonly body: Buffer;
  readonly contentType: string;
  readonly headers: JsonObject;
  readonly idempotencyKey: string;
  readonly login: PasswordCredentials | null;
}

export interface ReceivedBrokerMessage {
  readonly body: Buffer;
  readonly contentType: string | null;
  readonly headers: JsonObject;
  readonly correlationId: string | null;
}

export interface EncodedInbox {
  readonly subscriber: string;
  readonly ended: AbortSignal;
  demanded(): Promise<void>;
  deliver(message: ReceivedBrokerMessage): Promise<void>;
  lost(): void;
}

export interface Broker {
  publish(
    target: BrokerTarget,
    message: EncodedMessage,
    signal: AbortSignal,
  ): Promise<void>;
  subscribe(
    target: BrokerTarget,
    login: PasswordCredentials | null,
    inbox: EncodedInbox,
  ): Promise<BrokerSubscription>;
}

export interface Consumer {
  readonly stopped: AbortController;
  readonly done: Promise<void>;
}
