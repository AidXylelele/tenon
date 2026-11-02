import type { EventRepository } from '../../src/application/automation/events/ports.js';
import type {
  InstanceRuns,
  ProcessRunner,
  ServiceCaller,
  WorkflowInstanceRepository,
} from '../../src/application/automation/instances/ports.js';
import type {
  InstancePage,
  InstanceQueries,
  InstanceView,
  EventPage,
  TaskRecordPage,
} from '../../src/application/automation/instances/queries.js';
import type {
  Clock,
  SchemaValidator,
} from '../../src/application/automation/language/ports.js';
import type {
  PageRequest,
  VersionDocument,
  VersionSummary,
  WorkflowPage,
  WorkflowQueries,
  WorkflowSummary,
} from '../../src/application/automation/workflows/queries.js';
import type { Event } from '../../src/domain/automation/events/event.js';
import type { InstanceEvent } from '../../src/domain/automation/instances/interfaces.js';
import type { WorkflowInstance } from '../../src/domain/automation/instances/workflow-instance.js';
import { StaleWriteError } from '../../src/domain/errors.js';
import type {
  TaskInstanceRow,
  WorkflowInstanceRow,
} from '../../src/interface-adapters/persistence/interfaces.js';
import { TaskInstanceMapper } from '../../src/interface-adapters/persistence/mappers/task-instance.mapper.js';
import { WorkflowInstanceMapper } from '../../src/interface-adapters/persistence/mappers/workflow-instance.mapper.js';
import type {
  ProcessRun,
  ServiceCall,
  SubWorkflowEnding,
  Validation,
} from '../../src/domain/automation/language/interfaces.js';
import type { ProcessResult } from '../../src/domain/automation/language/results/process-result.js';
import type { ServiceResult } from '../../src/domain/automation/language/results/service-result.js';
import { Validated } from '../../src/domain/automation/language/results/validated.js';
import type { ValidationResult } from '../../src/domain/automation/language/results/validation-result.js';
import type { WorkflowName } from '../../src/domain/automation/language/workflow-name.js';
import { DocumentFormat } from '../../src/domain/automation/workflows/enums.js';
import type { InMemoryWorkflowVersionRepository } from './fakes.js';

// Stores rows through the persistence mappers, as the real repository does, so a reload never
// shares state with the copy that was saved and brings back only the active tasks.
export class InMemoryWorkflowInstanceRepository implements WorkflowInstanceRepository {
  readonly rows = new Map<string, WorkflowInstanceRow>();
  readonly taskRows = new Map<string, TaskInstanceRow>();
  readonly domainEvents: InstanceEvent[] = [];
  saves = 0;

  async find(id: string): Promise<WorkflowInstance | null> {
    return this.load(id);
  }

  load(id: string): WorkflowInstance | null {
    const row = this.rows.get(id);

    if (row === undefined) return null;

    const active = Array.from(this.taskRows.values())
      .filter((task) => task.instanceId === id && task.endedAt === null)
      .sort((left, right) => left.execution - right.execution);
    const tasks = active.map((task) =>
      TaskInstanceMapper.toEntity(structuredClone(task)),
    );
    return WorkflowInstanceMapper.toEntity(structuredClone(row), tasks);
  }

  async save(instance: WorkflowInstance): Promise<void> {
    if (!instance.changed) return;

    const stored = this.rows.get(instance.id);

    if (stored !== undefined && stored.version !== instance.version)
      throw new StaleWriteError();

    const row = WorkflowInstanceMapper.toRow(instance);
    const saved = structuredClone(row);
    this.rows.set(instance.id, { ...saved, version: instance.version + 1 });

    for (const task of instance.tasks) {
      const taskRow = TaskInstanceMapper.toRow(task, instance.id);
      this.taskRows.set(taskRow.id, structuredClone(taskRow));
    }

    const events = instance.takeDomainEvents();
    this.domainEvents.push(...events);
    this.saves += 1;
  }
}

export class RecordingInstanceRuns implements InstanceRuns {
  readonly started: string[] = [];

  async start(instanceId: string): Promise<void> {
    this.started.push(instanceId);
  }
}

export class RecordingEventRepository implements EventRepository {
  readonly events: Event[] = [];

  async addAll(events: readonly Event[]): Promise<void> {
    this.events.push(...events);
  }
}

export class FixedClock implements Clock {
  constructor(public time: Date) {}

  now(): Date {
    return this.time;
  }
}

export class ScriptedServiceCaller implements ServiceCaller {
  readonly calls: ServiceCall[] = [];

  constructor(
    private readonly respond: (call: ServiceCall) => ServiceResult | null,
  ) {}

  async callAll(
    calls: readonly ServiceCall[],
  ): Promise<readonly ServiceResult[]> {
    this.calls.push(...calls);
    const results = calls.map((call) => this.respond(call));
    return results.filter((result) => result !== null);
  }
}

export class ScriptedProcessRunner implements ProcessRunner {
  readonly runs: ProcessRun[] = [];

  constructor(
    private readonly exit: (run: ProcessRun) => ProcessResult | null = () =>
      null,
  ) {}

  async runAll(runs: readonly ProcessRun[]): Promise<readonly ProcessResult[]> {
    this.runs.push(...runs);
    const results = runs.map((run) => this.exit(run));
    return results.filter((result) => result !== null);
  }
}

export class AcceptingSchemaValidator implements SchemaValidator {
  check(): Promise<void> {
    return Promise.resolve();
  }

  async validateAll(
    validations: readonly Validation[],
  ): Promise<readonly ValidationResult[]> {
    return validations.map((validation) => new Validated(validation.id));
  }
}

export class InMemoryWorkflowQueries implements WorkflowQueries {
  constructor(private readonly store: InMemoryWorkflowVersionRepository) {}

  async list(page: PageRequest): Promise<WorkflowPage> {
    return { items: [], next: page.cursor };
  }

  async get(name: WorkflowName): Promise<WorkflowSummary | null> {
    return {
      namespace: name.namespace,
      name: name.name,
      isOn: false,
      currentVersion: null,
    };
  }

  async versions(): Promise<readonly VersionSummary[]> {
    return [];
  }

  async document(): Promise<VersionDocument | null> {
    return null;
  }

  async documentOf(versionId: string): Promise<VersionDocument | null> {
    const version = this.store.versions.find(
      (candidate) => candidate.id === versionId,
    );

    if (version === undefined) return null;

    return { format: DocumentFormat.Json, text: version.source.text };
  }
}

export class InMemoryInstanceQueries implements InstanceQueries {
  constructor(private readonly instances: InMemoryWorkflowInstanceRepository) {}

  async list(): Promise<InstancePage> {
    return { items: [], next: null };
  }

  async exists(id: string): Promise<boolean> {
    return this.instances.rows.has(id);
  }

  async get(): Promise<InstanceView | null> {
    return null;
  }

  async tasks(): Promise<TaskRecordPage> {
    return { items: [], next: null };
  }

  async lifecycleEvents(): Promise<EventPage> {
    return { items: [], next: null };
  }

  async subWorkflowEnding(id: string): Promise<SubWorkflowEnding | null> {
    const instance = this.instances.load(id);

    if (instance === null) return null;

    return {
      phase: instance.phase,
      output: instance.output,
      error: instance.error,
    };
  }
}
