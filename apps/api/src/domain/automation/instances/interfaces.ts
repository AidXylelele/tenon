import type { JsonObject, JsonValue } from '../json.js';
import type { InstanceEventKind, Phase, TriggerKind } from './enums.js';

export interface WorkflowInstanceProps {
  readonly id: string;
  readonly workflowId: string;
  readonly versionId: string;
  readonly trigger: TriggerKind;
  readonly starterId: string | null;
  readonly originId: string | null;
  readonly input: JsonValue;
  readonly phase: Phase;
  readonly output: JsonValue | null;
  readonly error: JsonObject | null;
  readonly createdAt: Date;
  readonly startedAt: Date | null;
  readonly endedAt: Date | null;
  readonly waiting: boolean;
  readonly version: number;
}

// A change of an instance that the engine running it must learn of, after the commit.
export interface InstanceEvent {
  readonly kind: InstanceEventKind;
  readonly instanceId: string;
}
