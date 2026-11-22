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
