import type { WorkflowStructure } from "language-server/protocol";
import type { JsonObject, JsonValue } from "@/libs/json/json";
import type { Problem } from "./problem";

export interface Page<T> {
  readonly items: T[];
  readonly next: string | null;
}

export type Read<T> = T & { readonly readAt: number };

export type Role = "admin" | "editor" | "viewer";

export interface User {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: Role;
}

export interface Capabilities {
  readonly author: boolean;
  readonly operator: boolean;
  readonly administrator: boolean;
}

export interface Session {
  readonly user: User;
  readonly capabilities: Capabilities;
}

export interface Person {
  readonly id: string;
  readonly name: string;
}

export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export interface Invitation {
  readonly id: string;
  readonly email: string;
  readonly role: Role;
  readonly status: InvitationStatus;
  readonly expiresAt: string;
  readonly createdAt: string;
}

export type MemberStatus = "active" | "suspended" | "invited";

export interface Member {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly role: Role;
  readonly status: MemberStatus;
  readonly since: string;
}

export interface InvitationPreview {
  readonly email: string;
  readonly role: Role;
}

export type WorkflowStatus = "active" | "archived";

export type Schedule =
  | { readonly kind: "every"; readonly interval: number }
  | { readonly kind: "cron"; readonly cron: string }
  | { readonly kind: "after"; readonly delay: number }
  | { readonly kind: "on"; readonly stream: string };

export interface LastRun {
  readonly id: string;
  readonly phase: Phase;
  readonly createdAt: string;
}

export interface WeekRuns {
  readonly runs: number;
  readonly failed: number;
}

export interface Workflow {
  readonly namespace: string;
  readonly name: string;
  readonly title: string | null;
  readonly status: WorkflowStatus;
  readonly on: boolean;
  readonly currentVersion: string | null;
  readonly schedule: Schedule | null;
  readonly week: WeekRuns;
  readonly lastRun: LastRun | null;
}

export interface Version {
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
  readonly current: boolean;
  readonly publishedBy: Person;
  readonly publishedAt: string;
  readonly runs: number;
}

export interface LifecycleEvent {
  readonly name: string;
  readonly types: readonly string[];
}

export interface HostProfile {
  readonly effects: readonly string[];
  readonly authentications: readonly string[];
  readonly processes: readonly string[];
  readonly scriptLanguages: readonly string[];
  readonly asyncApiProtocols: readonly string[];
  readonly mcpTransports: readonly string[];
  readonly schedules: readonly string[];
  readonly triggers: "one" | "many";
  readonly mcpTransportOptions: readonly string[];
  readonly grants: readonly string[];
  readonly lifecycleEvents: readonly LifecycleEvent[];
  readonly shell: {
    readonly platform: string;
    readonly shell: string;
    readonly commands: readonly string[];
  };
  readonly limits: {
    readonly callSeconds: number;
    readonly processSeconds: number;
    readonly responseBytes: number;
  };
}

export interface InputSchema {
  readonly format: string;
  readonly document: JsonValue;
}

export interface VersionStructure extends WorkflowStructure {
  readonly summary: string | null;
  readonly input: { readonly schema: InputSchema | null };
}

export interface DraftContent {
  readonly source: string;
  readonly layout: JsonObject;
}

export interface Draft extends DraftContent {
  readonly savedBy: Person;
  readonly savedAt: string;
}

export interface DraftRevision {
  readonly draft: Draft;
  readonly etag: string;
}

interface DraftRefused {
  readonly kind: "refused";
  readonly problem: Problem;
}

export type DraftRefusal =
  | { readonly kind: "conflict"; readonly current: DraftRevision | null }
  | DraftRefused;

export type DraftWrite =
  { readonly kind: "saved"; readonly revision: DraftRevision } | DraftRefusal;

export type DraftPublication =
  { readonly kind: "published"; readonly version: Version } | DraftRefusal;

export type DraftTestRun =
  { readonly kind: "started"; readonly run: InstanceSummary } | DraftRefusal;

export type DraftAnswer =
  { readonly kind: "answered"; readonly response: Response } | DraftRefused;

export type DraftCheck =
  | { readonly kind: "unchanged" }
  | { readonly kind: "changed"; readonly revision: DraftRevision }
  | { readonly kind: "missing" };

export type Phase =
  | "pending"
  | "running"
  | "waiting"
  | "suspended"
  | "cancelled"
  | "faulted"
  | "completed";

export type Trigger =
  "manual" | "schedule" | "event" | "parent" | "detached" | "restart";

export interface InstanceSummary {
  readonly id: string;
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
  readonly phase: Phase;
  readonly trigger: Trigger;
  readonly test: boolean;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly endedAt: string | null;
}

export interface ListedWait {
  readonly kind: Wait["kind"];
  readonly until: string | null;
  readonly stream: string | null;
}

export interface ListedInstance extends InstanceSummary {
  readonly title: string | null;
  readonly startedBy: Person | null;
  readonly durationMs: number | null;
  readonly waits: readonly ListedWait[];
}

export interface InstancePage {
  readonly items: readonly ListedInstance[];
  readonly total: number;
  readonly exact: boolean;
}

interface WorkflowError {
  readonly type: string;
  readonly status: number;
  readonly instance: string;
  readonly title?: string;
  readonly detail?: string;
}

export type Control = "suspend" | "resume" | "cancel" | "restart" | "delete";

export interface Wait {
  readonly kind: "timer" | "event" | "child" | "message";
  readonly until: string | null;
  readonly stream: string | null;
  readonly instanceId: string | null;
}

export interface Instance extends InstanceSummary {
  readonly input: JsonValue;
  readonly output: JsonValue;
  readonly error: WorkflowError | null;
  readonly originId: string | null;
  readonly startedBy: Person | null;
  readonly controls: readonly Control[];
  readonly cancelReason: string | null;
  readonly waits: readonly Wait[];
}

export type TaskStatus =
  "running" | "completed" | "faulted" | "cancelled" | "skipped";

export interface TaskRecord {
  readonly execution: string;
  readonly reference: string;
  readonly name: string;
  readonly status: TaskStatus;
  readonly error: WorkflowError | null;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly attempt: number;
  readonly input: JsonValue;
  readonly output: JsonValue;
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

export type PhaseCounts = Readonly<Record<Phase, number>>;

export type LivePhase = "pending" | "running" | "waiting" | "suspended";

export interface CountedBucket {
  readonly start: string;
  readonly counts: PhaseCounts;
}

export interface InstanceCounts {
  readonly to: string;
  readonly buckets: readonly CountedBucket[];
  readonly total: PhaseCounts;
  readonly previous: {
    readonly from: string;
    readonly counts: PhaseCounts;
  } | null;
  readonly now: Readonly<Record<LivePhase, number>>;
}

export interface CountWindow {
  readonly buckets: readonly string[];
  readonly to: string;
  readonly previousFrom?: string;
  readonly namespace?: string;
  readonly name?: string;
}

export type InstanceOrder = "started" | "duration";

export interface InstanceFilter {
  readonly namespace?: string;
  readonly name?: string;
  readonly version?: string;
  readonly phases?: readonly Phase[];
  readonly from?: string;
  readonly to?: string;
  readonly sort?: InstanceOrder;
  readonly page?: number;
  readonly limit?: number;
}

export interface FailureWindow {
  readonly from: string;
  readonly to: string;
  readonly limit: number;
}

export interface LastError {
  readonly status: number | null;
  readonly type: string | null;
  readonly title: string | null;
  readonly detail: string | null;
}

export interface FailingWorkflow {
  readonly namespace: string;
  readonly name: string;
  readonly title: string | null;
  readonly failed: number;
  readonly runs: number;
  readonly firstFailedAt: string;
  readonly lastFailedAt: string;
  readonly lastError: LastError;
  readonly stillFailing: boolean;
}

export interface FailingWorkflows {
  readonly items: readonly FailingWorkflow[];
  readonly workflows: number;
  readonly failed: number;
}

export interface ExpectedStarts {
  readonly namespace: string;
  readonly name: string;
  readonly title: string | null;
  readonly lastRun: LastRun | null;
  readonly schedule: Schedule | null;
  readonly next: readonly string[];
  readonly missed: number;
  readonly missedSince: string;
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
  readonly usedBy: readonly WorkflowVersionName[];
}

export interface ImportText {
  readonly text: string;
}

interface WorkflowVersionName {
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
}

export type DeliveryScheme = "basic" | "bearer";

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

export type DeliveryStatus = "pending" | "delivered" | "failed";

export interface Delivery {
  readonly eventId: string;
  readonly type: string;
  readonly status: DeliveryStatus;
  readonly attempts: number;
  readonly lastError: string | null;
  readonly lastAttemptAt: string | null;
}

export interface SubscriptionDetail extends Subscription {
  readonly deliveries: Delivery[];
}
