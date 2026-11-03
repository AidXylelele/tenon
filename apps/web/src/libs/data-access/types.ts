import type { JsonObject, JsonValue } from '@/libs/document-text/json';

// The API's resources as the console reads them, written from the contracts of features 001
// and 002. Unknown fields are ignored (Postel's law).

export interface Page<T> {
  readonly items: T[];
  readonly next: string | null;
}

// A value as the console read it, with when it arrived (ms since the epoch), so a live view
// can say how fresh it is.
export type Read<T> = T & { readonly readAt: number };

export type Role = 'admin' | 'editor' | 'viewer';

export interface User {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: Role;
}

export interface Session {
  readonly user: User;
}

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface Invitation {
  readonly id: string;
  readonly email: string;
  readonly role: Role;
  readonly status: InvitationStatus;
  readonly expiresAt: string;
  readonly createdAt: string;
}

export interface InvitationPreview {
  readonly email: string;
  readonly role: Role;
  readonly expiresAt: string;
}

export type WorkflowStatus = 'active' | 'archived';

export interface Workflow {
  readonly namespace: string;
  readonly name: string;
  readonly status: WorkflowStatus;
  readonly on: boolean;
  readonly currentVersion: string | null;
}

export interface Version {
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
  readonly dsl: string;
  readonly current: boolean;
  readonly publishedBy: string;
  readonly publishedAt: string;
}

export type Phase =
  | 'pending'
  | 'running'
  | 'waiting'
  | 'suspended'
  | 'cancelled'
  | 'faulted'
  | 'completed';

export type Trigger =
  'manual' | 'schedule' | 'event' | 'parent' | 'detached' | 'restart';

export interface InstanceSummary {
  readonly id: string;
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
  readonly phase: Phase;
  readonly trigger: Trigger;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly endedAt: string | null;
}

export interface WorkflowError {
  readonly type: string;
  readonly status: number;
  readonly instance: string;
  readonly title?: string;
  readonly detail?: string;
}

export interface Instance extends InstanceSummary {
  readonly input: JsonValue;
  readonly output: JsonValue;
  readonly error: WorkflowError | null;
  readonly originId: string | null;
  readonly starterId: string | null;
}

export type TaskStatus =
  'running' | 'completed' | 'faulted' | 'cancelled' | 'skipped';

export interface TaskRecord {
  readonly execution: string;
  readonly reference: string;
  readonly name: string;
  readonly status: TaskStatus;
  readonly input: JsonValue;
  readonly output: JsonValue;
  readonly error: WorkflowError | null;
  readonly startedAt: string;
  readonly endedAt: string | null;
  // Which attempt of the step the execution is: above 1 when a retry or an outage repeated it.
  readonly attempt: number;
  // When the next attempt begins, for a faulted attempt that is retried.
  readonly retryAt: string | null;
}

export interface CloudEvent {
  readonly specversion: string;
  readonly id: string;
  readonly source: string;
  readonly type: string;
  readonly subject?: string;
  readonly time?: string;
  readonly datacontenttype?: string;
  readonly data?: JsonValue;
}

export interface InstanceFilter {
  readonly namespace?: string;
  readonly name?: string;
  readonly version?: string;
  readonly phase?: Phase;
  readonly startedFrom?: string;
  readonly startedTo?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface Webhook {
  readonly id: string;
  readonly name: string;
  readonly eventType: string;
  readonly createdAt: string;
}

export interface CreatedWebhook extends Webhook {
  readonly url: string;
}

export interface Secret {
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type DeliveryScheme = 'basic' | 'bearer';

export interface Endpoint {
  readonly uri: string;
  readonly authentication?: {
    readonly scheme: DeliveryScheme;
    readonly secret: string;
  };
}

export interface EventFilter {
  readonly with: JsonObject;
}

export interface Subscription {
  readonly id: string;
  readonly name: string;
  readonly endpoint: Endpoint;
  readonly filter: EventFilter;
  readonly createdAt: string;
}

export type DeliveryStatus = 'pending' | 'delivered' | 'failed';

export interface Delivery {
  readonly eventId: string;
  readonly type: string;
  readonly status: DeliveryStatus;
  readonly attempts: number;
  readonly lastError: string | null;
  readonly firstAttemptAt: string | null;
  readonly lastAttemptAt: string | null;
}

export interface SubscriptionDetail extends Subscription {
  readonly deliveries: Delivery[];
}

export interface ConformanceStatement {
  readonly dsl: string[];
  readonly tasks: string[];
  readonly calls: string[];
  readonly runs: string[];
  readonly scriptLanguages: string[];
  readonly authentications: string[];
  readonly excluded: string[];
  readonly contradictions: string[];
}
