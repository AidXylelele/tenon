import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  type Phase,
  TriggerKind,
} from "../../src/domain/automation/instances/enums.js";
import type { RunWait } from "../../src/domain/automation/instances/interfaces.js";
import type { JsonObject } from "../../src/domain/automation/interfaces.js";
import { WorkflowStatus } from "../../src/domain/automation/workflows/enums.js";
import type { ScheduleSpec } from "../../src/domain/automation/workflows/interfaces.js";
import { Role } from "../../src/domain/identity/users/enums.js";
import type { Database } from "../../src/interface-adapters/persistence/interfaces.js";
import {
  user as users,
  workflow as workflows,
  workflowInstance as instances,
  workflowVersion as versions,
} from "../../src/interface-adapters/persistence/schema/index.js";

export interface WorkflowRows {
  readonly workflowId: string;
  readonly versionId: string;
}

export interface NewWorkflowRows {
  readonly namespace?: string;
  readonly name: string;
  readonly on?: boolean;
  readonly schedule?: ScheduleSpec | null;
}

export interface NewRunRow {
  readonly phase: Phase;
  readonly startedAt: Date | null;
  readonly endedAt?: Date | null;
  readonly createdAt?: Date;
  readonly test?: boolean;
  readonly trigger?: TriggerKind;
  readonly error?: JsonObject | null;
  readonly starterId?: string | null;
  readonly runWaits?: readonly RunWait[];
}

export async function aPublisher(db: Database, name = "Ada"): Promise<string> {
  const id = randomUUID();
  const email = `${id}@example.com`;
  await db.insert(users).values({ id, email, name, role: Role.Editor });
  return id;
}

export async function aWorkflowRow(
  db: Database,
  publisherId: string,
  workflow: NewWorkflowRows,
): Promise<WorkflowRows> {
  const workflowId = randomUUID();
  const versionId = randomUUID();
  await db.insert(workflows).values({
    id: workflowId,
    namespace: workflow.namespace ?? "sales",
    name: workflow.name,
    status: WorkflowStatus.Active,
    on: workflow.on ?? false,
  });
  await db.insert(versions).values({
    id: versionId,
    workflowId,
    semver: "1.0.0",
    dsl: "1.1.0",
    document: {},
    digest: versionId,
    programFingerprint: versionId,
    schedule: workflow.schedule ?? null,
    secrets: [],
    publisherId,
    publishedAt: new Date(0),
  });
  await db
    .update(workflows)
    .set({ currentVersionId: versionId })
    .where(sql`${workflows.id} = ${workflowId}`);
  return { workflowId, versionId };
}

export async function aRunRow(
  db: Database,
  workflow: WorkflowRows,
  run: NewRunRow,
): Promise<string> {
  const id = randomUUID();
  const createdAt = run.createdAt ?? run.startedAt ?? new Date();
  await db.insert(instances).values({
    id,
    workflowId: workflow.workflowId,
    versionId: workflow.versionId,
    trigger: run.trigger ?? TriggerKind.Manual,
    starterId: run.starterId ?? null,
    input: {},
    phase: run.phase,
    error: run.error ?? null,
    createdAt,
    startedAt: run.startedAt,
    endedAt: run.endedAt ?? null,
    test: run.test ?? false,
    runWaits: run.runWaits ?? [],
  });
  return id;
}

export async function truncateRuns(db: Database): Promise<void> {
  await db.execute(
    sql`truncate table workflow_instance, workflow_version, workflow, "user" cascade`,
  );
}
