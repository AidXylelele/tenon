import type {
  InstanceRuns,
  TaskProgress,
  TaskRecord,
  WorkflowInstanceRepository,
} from '../../src/application/automation/instances/ports.js';
import { TaskStatus } from '../../src/application/automation/instances/enums.js';
import type { Clock } from '../../src/application/automation/ports.js';
import type { WorkflowSchedules } from '../../src/application/automation/schedules/ports.js';
import type {
  WorkflowRepository,
  WorkflowVersionRepository,
} from '../../src/application/automation/workflows/ports.js';
import {
  Phase,
  TriggerKind,
} from '../../src/domain/automation/instances/enums.js';
import type {
  InstanceEvent,
  WorkflowInstanceProps,
} from '../../src/domain/automation/instances/interfaces.js';
import { WorkflowInstance } from '../../src/domain/automation/instances/workflow-instance.js';
import type { WorkflowProps } from '../../src/domain/automation/workflows/interfaces.js';
import { Workflow } from '../../src/domain/automation/workflows/workflow.js';
import type { WorkflowName } from '../../src/domain/automation/workflows/workflow-name.js';
import type { WorkflowVersion } from '../../src/domain/automation/workflows/workflow-version.js';
import { StaleWriteError } from '../../src/domain/errors.js';

// Fakes that behave like the Drizzle adapters: every find hydrates a fresh aggregate from a
// stored row, every save is an upsert fenced by the aggregate's version, and what an instance
// tells the engine lands in an outbox when it is saved or removed (then it is cleared).

export class FixedClock implements Clock {
  constructor(public current: Date) {}

  now(): Date {
    return this.current;
  }
}

function instanceRow(
  instance: WorkflowInstance,
  version: number,
): WorkflowInstanceProps {
  return {
    id: instance.id,
    workflowId: instance.workflowId,
    versionId: instance.versionId,
    trigger: instance.trigger,
    starterId: instance.starterId,
    originId: instance.originId,
    input: instance.input,
    phase: instance.phase,
    output: instance.output,
    error: instance.error,
    createdAt: instance.createdAt,
    startedAt: instance.startedAt,
    endedAt: instance.endedAt,
    waiting: instance.waiting,
    version,
  };
}

export class StoredWorkflowInstanceRepository implements WorkflowInstanceRepository {
  readonly rows = new Map<string, WorkflowInstanceProps>();
  readonly outbox: InstanceEvent[] = [];
  readonly removed: string[] = [];
  saves = 0;

  // Seeds rows as they were read: the instance's own version is kept.
  constructor(...instances: WorkflowInstance[]) {
    for (const instance of instances) this.put(instance);
  }

  put(instance: WorkflowInstance): void {
    const row = instanceRow(instance, instance.version);
    this.rows.set(instance.id, row);
  }

  async find(id: string): Promise<WorkflowInstance | null> {
    const row = this.rows.get(id);

    if (row === undefined) return null;

    return new WorkflowInstance(row);
  }

  async findAwaitedChildren(parentId: string): Promise<WorkflowInstance[]> {
    const rows = [...this.rows.values()].filter(
      (row) =>
        row.originId === parentId &&
        row.trigger === TriggerKind.Parent &&
        row.endedAt === null,
    );
    return rows.map((row) => new WorkflowInstance(row));
  }

  async hasUnendedScheduled(workflowId: string): Promise<boolean> {
    const rows = [...this.rows.values()];
    return rows.some(
      (row) =>
        row.workflowId === workflowId &&
        row.trigger === TriggerKind.Schedule &&
        row.endedAt === null,
    );
  }

  async save(instance: WorkflowInstance): Promise<void> {
    const stored = this.rows.get(instance.id);
    const stale = stored !== undefined && stored.version !== instance.version;

    if (stale) throw new StaleWriteError();

    const row = instanceRow(instance, instance.version + 1);
    this.rows.set(instance.id, row);
    this.saves += 1;
    this.#told(instance);
  }

  async remove(instance: WorkflowInstance): Promise<void> {
    this.rows.delete(instance.id);
    this.removed.push(instance.id);
    this.#told(instance);
  }

  phaseOf(id: string): Phase | undefined {
    return this.rows.get(id)?.phase;
  }

  #told(instance: WorkflowInstance): void {
    for (const event of instance.events) this.outbox.push(event);
    instance.clearEvents();
  }
}

function workflowRow(workflow: Workflow, version: number): WorkflowProps {
  return {
    id: workflow.id,
    name: workflow.name,
    status: workflow.status,
    on: workflow.on,
    currentVersionId: workflow.currentVersionId,
    archivedAt: workflow.archivedAt,
    version,
  };
}

export class StoredWorkflowRepository implements WorkflowRepository {
  readonly rows = new Map<string, WorkflowProps>();
  saves = 0;

  async findByName(name: WorkflowName): Promise<Workflow | null> {
    const row = [...this.rows.values()].find((item) => item.name.equals(name));

    if (row === undefined) return null;

    return new Workflow(row);
  }

  async findById(id: string): Promise<Workflow | null> {
    const row = this.rows.get(id);

    if (row === undefined) return null;

    return new Workflow(row);
  }

  async save(workflow: Workflow): Promise<void> {
    const stored = this.rows.get(workflow.id);
    const stale = stored !== undefined && stored.version !== workflow.version;
    const taken = [...this.rows.values()].some(
      (row) => row.id !== workflow.id && row.name.equals(workflow.name),
    );

    if (stale || taken) throw new StaleWriteError();

    const row = workflowRow(workflow, workflow.version + 1);
    this.rows.set(workflow.id, row);
    this.saves += 1;
  }
}

export class StoredWorkflowVersionRepository implements WorkflowVersionRepository {
  readonly versions = new Map<string, WorkflowVersion>();
  adds = 0;

  constructor(private readonly workflows: StoredWorkflowRepository) {}

  async find(
    name: WorkflowName,
    semver: string,
  ): Promise<WorkflowVersion | null> {
    const workflow = await this.workflows.findByName(name);

    if (workflow === null) return null;

    const found = [...this.versions.values()].find(
      (version) =>
        version.workflowId === workflow.id && version.semver === semver,
    );
    return found ?? null;
  }

  async findById(id: string): Promise<WorkflowVersion | null> {
    return this.versions.get(id) ?? null;
  }

  async findToRun(
    name: WorkflowName,
    semver: string | null,
  ): Promise<WorkflowVersion | null> {
    if (semver !== null) return this.find(name, semver);

    const workflow = await this.workflows.findByName(name);
    const current = workflow?.currentVersionId ?? null;

    if (current === null) return null;

    return this.versions.get(current) ?? null;
  }

  async findStartedOn(type: string): Promise<WorkflowVersion[]> {
    const current = new Set<string | null>();

    for (const row of this.workflows.rows.values())
      if (row.on) current.add(row.currentVersionId);

    return [...this.versions.values()].filter((version) => {
      const types = version.eventTypes;
      const takes =
        types !== null && (types.length === 0 || types.includes(type));
      return current.has(version.id) && takes;
    });
  }

  async add(version: WorkflowVersion): Promise<void> {
    if (this.versions.has(version.id)) return;

    const taken = [...this.versions.values()].some(
      (item) =>
        item.workflowId === version.workflowId &&
        item.semver === version.semver,
    );

    if (taken) throw new StaleWriteError();

    this.versions.set(version.id, version);
    this.adds += 1;
  }
}

// What the engine was asked to start, and whether the instance was stored by then.
export interface StartedRun {
  readonly instance: WorkflowInstance;
  readonly stored: boolean;
}

export class RecordingInstanceRuns implements InstanceRuns {
  readonly started: StartedRun[] = [];

  constructor(private readonly instances: StoredWorkflowInstanceRepository) {}

  async start(instance: WorkflowInstance): Promise<void> {
    const stored = this.instances.rows.has(instance.id);
    this.started.push({ instance, stored });
  }
}

export interface RecordedTask {
  readonly instanceId: string;
  readonly task: TaskRecord;
}

// Like the Drizzle store, a record of an instance that is not stored violates its foreign key.
export interface CancelledTasks {
  readonly instanceId: string;
  readonly at: Date;
}

export class RecordingTaskProgress implements TaskProgress {
  readonly starts: RecordedTask[] = [];
  readonly ends: RecordedTask[] = [];
  readonly cancellations: CancelledTasks[] = [];

  constructor(private readonly instances: StoredWorkflowInstanceRepository) {}

  async started(instanceId: string, task: TaskRecord): Promise<void> {
    this.#ensureStored(instanceId);
    this.starts.push({ instanceId, task });
  }

  async ended(instanceId: string, task: TaskRecord): Promise<void> {
    this.#ensureStored(instanceId);
    this.ends.push({ instanceId, task });
  }

  async cancelRunning(instanceId: string, at: Date): Promise<void> {
    this.#ensureStored(instanceId);
    this.cancellations.push({ instanceId, at });
  }

  #ensureStored(instanceId: string): void {
    const stored = this.instances.rows.has(instanceId);

    if (!stored) throw new Error('task_progress_instance_id_fkey violated');
  }
}

export const T0 = new Date('2026-11-03T10:00:00.000Z');

export interface InstanceOverrides {
  readonly id?: string;
  readonly workflowId?: string;
  readonly versionId?: string;
  readonly trigger?: TriggerKind;
  readonly originId?: string | null;
  readonly input?: WorkflowInstanceProps['input'];
  readonly startedAt?: Date | null;
  readonly endedAt?: Date | null;
  readonly version?: number;
}

const ENDED = [Phase.Completed, Phase.Faulted, Phase.Cancelled];

// An instance as a repository would hydrate it, in the phase given.
export function anInstanceIn(
  phase: Phase,
  overrides: InstanceOverrides = {},
): WorkflowInstance {
  const ended = ENDED.includes(phase);
  const begun = phase !== Phase.Pending;
  const startedAt = begun ? T0 : null;
  const endedAt = ended ? T0 : null;
  return new WorkflowInstance({
    id: overrides.id ?? 'instance-1',
    workflowId: overrides.workflowId ?? 'workflow-1',
    versionId: overrides.versionId ?? 'version-1',
    trigger: overrides.trigger ?? TriggerKind.Manual,
    starterId: 'author-1',
    originId: overrides.originId ?? null,
    input: overrides.input ?? { amount: 1 },
    phase,
    output: null,
    error: null,
    createdAt: T0,
    startedAt:
      overrides.startedAt === undefined ? startedAt : overrides.startedAt,
    endedAt: overrides.endedAt === undefined ? endedAt : overrides.endedAt,
    waiting: phase === Phase.Waiting,
    version: overrides.version ?? 1,
  });
}

export const aTask = (status: TaskStatus = TaskStatus.Running): TaskRecord => ({
  execution: 'greet-0',
  reference: '/do/0/greet',
  name: 'greet',
  status,
  input: { amount: 1 },
  output: null,
  error: null,
  attempt: 1,
  retryAt: null,
  at: T0,
});

export interface ContinuedChain {
  readonly instanceId: string;
  readonly versionId: string;
}

// The engine's side of schedules, recorded: which workflows' schedules were applied or cleared
// and which completed instances asked for the next link of a chain.
export class RecordingSchedules implements WorkflowSchedules {
  readonly applied: string[] = [];
  readonly cleared: string[] = [];
  readonly continued: ContinuedChain[] = [];

  async apply(workflow: Workflow, version: WorkflowVersion): Promise<void> {
    this.applied.push(`${workflow.id}@${version.id}`);
  }

  async clear(workflow: Workflow): Promise<void> {
    this.cleared.push(workflow.id);
  }

  async continueAfter(
    instance: WorkflowInstance,
    version: WorkflowVersion,
  ): Promise<void> {
    this.continued.push({ instanceId: instance.id, versionId: version.id });
  }
}
