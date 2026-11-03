import type {
  Phase,
  TriggerKind,
} from '../../../domain/automation/instances/enums.js';
import type { JsonObject, JsonValue } from '../../../domain/automation/json.js';
import type { TaskStatus } from './enums.js';

export interface InstanceSummary {
  readonly id: string;
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
  readonly phase: Phase;
  readonly trigger: TriggerKind;
  readonly createdAt: Date;
  readonly startedAt: Date | null;
  readonly endedAt: Date | null;
}

export interface InstanceDetail extends InstanceSummary {
  readonly input: JsonValue;
  readonly output: JsonValue | null;
  readonly error: JsonObject | null;
  readonly originId: string | null;
  readonly starterId: string | null;
}

export interface InstanceFilter {
  readonly namespace: string | null;
  readonly name: string | null;
  readonly version: string | null;
  readonly phase: Phase | null;
  // Instances started at or after, and at or before, these times.
  readonly startedFrom: Date | null;
  readonly startedTo: Date | null;
}

// The last instance of a page, newest first.
export interface InstancePosition {
  readonly createdAt: Date;
  readonly id: string;
}

export interface InstancePage {
  readonly items: readonly InstanceSummary[];
  readonly next: InstancePosition | null;
}

export interface TaskRecordView {
  readonly execution: string;
  readonly reference: string;
  readonly name: string;
  readonly status: TaskStatus;
  readonly input: JsonValue;
  readonly output: JsonValue;
  readonly error: JsonObject | null;
  readonly startedAt: Date;
  readonly endedAt: Date | null;
}

export interface TaskPage {
  readonly items: readonly TaskRecordView[];
  readonly next: number | null;
}

// What a run of the runtime needs: the version's document and the instance's input.
export interface RunPlanView {
  readonly instanceId: string;
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
  readonly document: JsonObject;
  readonly input: JsonValue;
  readonly startedAt: Date;
}

export abstract class InstanceQueries {
  abstract list(
    filter: InstanceFilter,
    after: InstancePosition | null,
    limit: number,
  ): Promise<InstancePage>;
  abstract get(id: string): Promise<InstanceDetail | null>;
  abstract tasks(
    id: string,
    after: number | null,
    limit: number,
  ): Promise<TaskPage | null>;
  abstract plan(id: string): Promise<RunPlanView | null>;
}
