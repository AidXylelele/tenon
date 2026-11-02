import type {
  JsonObject,
  JsonValue,
  SubWorkflowEnding,
} from '../../../domain/automation/language/interfaces.js';

export interface InstancePosition {
  readonly startedAt: Date;
  readonly id: string;
}

export interface InstancePageRequest {
  readonly after: InstancePosition | null;
  readonly limit: number;
}

export interface PositionPageRequest {
  readonly after: number | null;
  readonly limit: number;
}

export interface InstanceFilter {
  readonly namespace: string | null;
  readonly name: string | null;
  readonly version: string | null;
  readonly phase: string | null;
  readonly startedFrom: Date | null;
  readonly startedTo: Date | null;
}

export interface ErrorView {
  readonly type: string;
  readonly status: number;
  readonly instance: string;
  readonly title: string | null;
  readonly detail: string | null;
}

export interface InstanceSummary {
  readonly id: string;
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
  readonly phase: string;
  readonly startedAt: Date;
  readonly endedAt: Date | null;
}

export interface InstancePage {
  readonly items: readonly InstanceSummary[];
  readonly next: InstancePosition | null;
}

export interface InstanceView extends InstanceSummary {
  readonly parentId: string | null;
  readonly input: JsonValue;
  readonly output: JsonValue;
  readonly error: ErrorView | null;
}

export interface TaskRecord {
  readonly id: string;
  readonly reference: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly phase: string | null;
  readonly input: JsonValue;
  readonly output: JsonValue;
  readonly error: ErrorView | null;
  readonly retries: number;
  readonly startedAt: Date;
  readonly endedAt: Date | null;
}

export interface TaskRecordPage {
  readonly items: readonly TaskRecord[];
  readonly next: number | null;
}

export interface EventView {
  readonly id: string;
  readonly source: string;
  readonly type: string;
  readonly time: Date;
  readonly subject: string | null;
  readonly dataContentType: string | null;
  readonly dataSchema: string | null;
  readonly data: JsonValue;
  readonly extensions: JsonObject;
}

export interface EventPage {
  readonly items: readonly EventView[];
  readonly next: number | null;
}

export abstract class InstanceQueries {
  abstract list(
    filter: InstanceFilter,
    page: InstancePageRequest,
  ): Promise<InstancePage>;
  abstract exists(id: string): Promise<boolean>;
  abstract get(id: string): Promise<InstanceView | null>;
  abstract tasks(
    id: string,
    page: PositionPageRequest,
  ): Promise<TaskRecordPage>;
  abstract lifecycleEvents(
    id: string,
    page: PositionPageRequest,
  ): Promise<EventPage>;
  abstract subWorkflowEnding(id: string): Promise<SubWorkflowEnding | null>;
}
