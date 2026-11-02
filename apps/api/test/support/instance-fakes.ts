import type {
  InstanceRuns,
  ProcessRunner,
  ServiceCaller,
  WorkflowInstanceRepository,
} from '../../src/application/automation/instances/ports.js';
import type { SubWorkflowQueries } from '../../src/application/automation/instances/queries.js';
import {
  Clock,
  type SchemaValidator,
} from '../../src/application/automation/language/ports.js';
import type {
  VersionDocument,
  VersionDocuments,
} from '../../src/application/automation/workflows/queries.js';
import type { Event } from '../../src/domain/automation/events/event.js';
import type { InstanceEvent } from '../../src/domain/automation/instances/interfaces.js';
import type { WorkflowInstance } from '../../src/domain/automation/instances/workflow-instance.js';
import {
  InstanceNotFoundError,
  StaleWriteError,
} from '../../src/domain/errors.js';
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
import { DocumentFormat } from '../../src/domain/automation/workflows/enums.js';
import type { InMemoryWorkflowVersionRepository } from './fakes.js';

// Stores rows through the persistence mappers, as the real repository does, so a reload never
// shares state with the copy that was saved and brings back only the active tasks.
export class InMemoryWorkflowInstanceRepository implements WorkflowInstanceRepository {
  constructor(
    private readonly events: RecordingEventRepository = new RecordingEventRepository(),
  ) {}

  readonly rows = new Map<string, WorkflowInstanceRow>();
  readonly taskRows = new Map<string, TaskInstanceRow>();
  readonly domainEvents: InstanceEvent[] = [];
  saves = 0;

  async find(id: string): Promise<WorkflowInstance | null> {
    return this.load(id);
  }

  async get(id: string): Promise<WorkflowInstance> {
    const instance = this.load(id);

    if (instance === null) throw new InstanceNotFoundError();

    return instance;
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

    const produced = instance.takeProducedEvents();
    await this.events.addAll(produced);
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

export class RecordingEventRepository {
  readonly events: Event[] = [];

  async addAll(events: readonly Event[]): Promise<void> {
    this.events.push(...events);
  }
}

export class SystemClock extends Clock {
  now(): Date {
    return new Date();
  }
}

export class FixedClock extends Clock {
  constructor(public time: Date) {
    super();
  }

  now(): Date {
    return this.time;
  }
}

// Answers each call after `delay` milliseconds of real time, so tests can order the answers.
export class ScriptedServiceCaller implements ServiceCaller {
  readonly calls: ServiceCall[] = [];

  constructor(
    private readonly respond: (call: ServiceCall) => ServiceResult | null,
    private readonly delay: (call: ServiceCall) => number = () => 0,
  ) {}

  async call(call: ServiceCall): Promise<ServiceResult | null> {
    this.calls.push(call);
    const wait = this.delay(call);

    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));

    return this.respond(call);
  }
}

export class ScriptedProcessRunner implements ProcessRunner {
  readonly runs: ProcessRun[] = [];

  constructor(
    private readonly exit: (run: ProcessRun) => ProcessResult | null = () =>
      null,
  ) {}

  async run(run: ProcessRun): Promise<ProcessResult | null> {
    this.runs.push(run);
    return this.exit(run);
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

export class InMemoryVersionDocuments implements VersionDocuments {
  constructor(private readonly store: InMemoryWorkflowVersionRepository) {}

  async documentOf(versionId: string): Promise<VersionDocument | null> {
    const version = this.store.versions.find(
      (candidate) => candidate.id === versionId,
    );

    if (version === undefined) return null;

    return { format: DocumentFormat.Json, text: version.source.text };
  }
}

export class InMemorySubWorkflowQueries implements SubWorkflowQueries {
  constructor(private readonly instances: InMemoryWorkflowInstanceRepository) {}

  async exists(id: string): Promise<boolean> {
    return this.instances.rows.has(id);
  }

  async endingOf(id: string): Promise<SubWorkflowEnding | null> {
    const instance = this.instances.load(id);

    if (instance === null) return null;

    return {
      phase: instance.phase,
      output: instance.output,
      error: instance.error,
    };
  }
}
