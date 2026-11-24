import type { EffectKind } from "../../domain/automation/instances/enums.js";

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

export interface ChildEndedMessage {
  readonly instanceId: string;
  readonly parentId: string;
}

export interface EffectMessage {
  readonly instanceId: string;
  readonly effectId: string;
  readonly effect: EffectKind;
}

export interface ProcessMessage {
  readonly instanceId: string;
  readonly effectId: string;
  readonly versionId: string;
  readonly sealedRequest: string;
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
  readonly sealedOutcome: string;
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
