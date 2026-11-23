import type {
  AsyncApiInboundMessage,
  AsyncApiRequest,
  Failure,
  JsonObject,
} from "interpreter";
import type { EffectKind } from "../../domain/automation/instances/enums.js";
import type { JsonObject as DomainObject } from "../../domain/automation/interfaces.js";
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

export interface InstanceEndedMessage {
  readonly instanceId: string;
  readonly parentId: string | null;
}

export interface EffectMessage {
  readonly instanceId: string;
  readonly effectId: string;
  readonly effect: EffectKind;
}

export interface TimerMessage {
  readonly instanceId: string;
  readonly effectId: string;
  readonly at: number;
}

export interface DeliveryMessage {
  readonly subscriptionId: string;
  readonly sequence: number;
}

export interface RespondMessage {
  readonly instanceId: string;
  readonly effectId: string;
  readonly outcome: DomainObject;
}

export interface ScheduleMessage {
  readonly workflowId: string;
  readonly arming: number;
  readonly at: number;
}

export interface ScheduleFiredMessage {
  readonly workflowId: string;
  readonly at: number;
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
  readonly credential: JsonObject | null;
  readonly event: JsonObject;
}

export abstract class DeliveryAdmission {
  abstract admits(uri: string): Promise<boolean>;
}

export abstract class EventDeliveries {
  abstract admits(uri: string): Promise<boolean>;
  abstract deliver(delivery: EventDelivery): Promise<string | null>;
}
