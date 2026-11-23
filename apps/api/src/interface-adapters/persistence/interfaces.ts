import type { TransactionalAdapterDrizzleOrm } from "@nestjs-cls/transactional-adapter-drizzle-orm";
import type {
  AwaitedEffect,
  Listening,
  Receiving,
  RunWait,
  TakenEvent,
} from "../../domain/automation/instances/interfaces.js";
import type {
  Phase,
  TaskValueKind,
  TriggerKind,
} from "../../domain/automation/instances/enums.js";
import type {
  JsonObject,
  JsonValue,
} from "../../domain/automation/interfaces.js";
import type { WorkflowStatus } from "../../domain/automation/workflows/enums.js";
import type { Schedule } from "../../domain/automation/workflows/interfaces.js";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { lifecycleEventCatalogue } from "interpreter";
import type { CloudEvent } from "../../application/automation/events/interfaces.js";
import type * as schema from "./schema/index.js";

export type Database = NodePgDatabase<typeof schema>;

export type Transaction = TransactionalAdapterDrizzleOrm<Database>;

export type AccountRow = typeof schema.account.$inferSelect;

export type DraftRow = typeof schema.draft.$inferSelect;

export type EventRow = typeof schema.event.$inferInsert;

export type IdempotencyKeyRow = typeof schema.idempotencyKey.$inferSelect;

export type InvitationRow = typeof schema.invitation.$inferSelect;

export type SecretRow = typeof schema.secret.$inferSelect;

export type SealedSecretRow = Pick<SecretRow, "name" | "sealed">;

export type SessionRow = typeof schema.session.$inferSelect;

export type SubscriptionRow = typeof schema.subscription.$inferSelect;

export type UserRow = typeof schema.user.$inferSelect;

export type WebhookRow = typeof schema.webhook.$inferSelect;

export type WorkflowInstanceRow = typeof schema.workflowInstance.$inferSelect;

export type WorkflowRow = typeof schema.workflow.$inferSelect;

export type WorkflowVersionRow = typeof schema.workflowVersion.$inferSelect;

export type VersionCatalogueRow = Omit<
  WorkflowVersionRow,
  "workflowId" | "document" | "imports" | "source"
>;

export interface ListedInstanceRow {
  readonly id: string;
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
  readonly phase: Phase;
  readonly trigger: TriggerKind;
  readonly test: boolean;
  readonly createdAt: Date;
  readonly startedAt: Date | null;
  readonly endedAt: Date | null;
  readonly starterId: string | null;
  readonly starterName: string | null;
  readonly durationMs: number | null;
  readonly runWaits: readonly RunWait[];
}

export interface FailingRow {
  readonly namespace: string;
  readonly name: string;
  readonly failed: number;
  readonly runs: number;
  readonly firstFailedAt: Date;
  readonly lastFailedAt: Date;
  readonly status: number | null;
  readonly type: string | null;
  readonly title: string | null;
  readonly detail: string | null;
  readonly stillFailing: boolean;
  readonly workflows: number;
  readonly failedRuns: number;
}

export interface CountRow {
  readonly bucket: number;
  readonly phase: Phase;
  readonly count: number;
}

export interface TaskPosition {
  readonly execution: string;
  readonly opened: number;
}

export type LifecycleEventName = keyof typeof lifecycleEventCatalogue;

export interface LifecycleCloudEvent {
  readonly cloudEvent: CloudEvent;
  readonly lifecycle: LifecycleEventName | null;
}

export interface LifecycleEventRow {
  readonly name: LifecycleEventName;
  readonly data: JsonObject;
  readonly acceptedAt: Date;
}

export interface TaskEventRow extends LifecycleEventRow {
  readonly execution: string;
}

export interface TaskValueRow {
  readonly execution: string;
  readonly kind: TaskValueKind;
  readonly sealedValue: string;
}

export interface TaskValues {
  readonly input: JsonValue | null;
  readonly output: JsonValue | null;
}

export interface InstanceNames {
  readonly namespace: string;
  readonly name: string;
}

export interface SealedRun {
  readonly memento: JsonObject;
  readonly awaited: readonly AwaitedEffect[];
  readonly listening: readonly Listening[];
  readonly receiving: readonly Receiving[];
  readonly taken: readonly TakenEvent[];
  readonly secretTexts: readonly string[];
  readonly output: JsonValue | null;
  readonly error: JsonObject | null;
}

export interface WorkflowSummaryRow {
  readonly namespace: string;
  readonly name: string;
  readonly title: string | null;
  readonly status: WorkflowStatus;
  readonly on: boolean;
  readonly currentVersion: string | null;
  readonly schedule: Schedule | null;
  readonly starts: number;
  readonly lastRunId: string | null;
  readonly lastRunPhase: Phase | null;
  readonly lastRunAt: Date | null;
}

export interface VersionSummaryRow {
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
  readonly dsl: string;
  readonly current: boolean;
  readonly publisherId: string;
  readonly publisherName: string;
  readonly publishedAt: Date;
}

export abstract class Cipher {
  abstract seal(value: string): string;
  abstract open(sealed: string): string;
}
