import type {
  AsyncApiInboundMessage,
  AsyncApiRequest,
  Failure,
} from "interpreter";
import type { CloudEvent } from "../../application/automation/events/interfaces.js";
import type { StepCall } from "../workflows/interfaces.js";

export interface AcceptedEventMessage {
  readonly sequence: number;
}

export interface EventOfferedMessage {
  readonly instanceId: string;
  readonly sequence: number;
  readonly candidates: readonly string[];
}

export interface TriggerOfferedMessage {
  readonly workflowId: string;
  readonly sequence: number;
}

export interface InstanceMessage {
  readonly instanceId: string;
}

export interface WorkflowMessage {
  readonly workflowId: string;
}

export interface AsyncApiInbox {
  readonly ended: AbortSignal;
  demanded(): Promise<void>;
  message(message: AsyncApiInboundMessage): Promise<void>;
  failure(failure: Failure): Promise<void>;
  lost(): void;
}

export interface BrokerSubscription {
  close(): Promise<void>;
}

export interface Consumer {
  readonly stopped: AbortController;
  readonly done: Promise<void>;
}

export type Subscribed =
  | {
      readonly kind: "subscribed";
      readonly subscription: BrokerSubscription;
    }
  | Failure;

export abstract class SubscriptionClient {
  abstract subscribe(
    request: AsyncApiRequest,
    step: StepCall,
    inbox: AsyncApiInbox,
  ): Promise<Subscribed>;
}

export interface EventDelivery {
  readonly uri: string;
  readonly scheme: "basic" | "bearer" | null;
  readonly credential: string | null;
  readonly event: CloudEvent;
}

export abstract class EventDeliveries {
  abstract admits(uri: string): Promise<boolean>;
  abstract deliver(delivery: EventDelivery): Promise<string | null>;
}
