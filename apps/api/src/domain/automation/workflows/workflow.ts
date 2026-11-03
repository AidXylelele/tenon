import { randomUUID } from 'node:crypto';
import type { Result } from '../../result.js';
import { InstanceRefusal, TriggerKind } from '../instances/enums.js';
import { WorkflowInstance } from '../instances/workflow-instance.js';
import { WorkflowEventKind, WorkflowRefusal, WorkflowStatus } from './enums.js';
import type {
  InstanceRestart,
  NewInstance,
  NewPublication,
  Publication,
  ScheduledStart,
  StartRefusal,
  WorkflowEvent,
  WorkflowProps,
} from './interfaces.js';
import type { WorkflowName } from './workflow-name.js';
import { WorkflowVersion } from './workflow-version.js';

export class Workflow {
  readonly #id: string;
  readonly #name: WorkflowName;
  readonly #version: number;
  #status: WorkflowStatus;
  #on: boolean;
  #currentVersionId: string | null;
  #archivedAt: Date | null;
  #events: WorkflowEvent[] = [];

  constructor(props: WorkflowProps) {
    this.#id = props.id;
    this.#name = props.name;
    this.#status = props.status;
    this.#on = props.on;
    this.#currentVersionId = props.currentVersionId;
    this.#archivedAt = props.archivedAt;
    this.#version = props.version;
  }

  static register(name: WorkflowName): Workflow {
    const id = randomUUID();
    return new Workflow({
      id,
      name,
      status: WorkflowStatus.Active,
      on: false,
      currentVersionId: null,
      archivedAt: null,
      version: 0,
    });
  }

  get id(): string {
    return this.#id;
  }

  get name(): WorkflowName {
    return this.#name;
  }

  get status(): WorkflowStatus {
    return this.#status;
  }

  get on(): boolean {
    return this.#on;
  }

  get currentVersionId(): string | null {
    return this.#currentVersionId;
  }

  get archivedAt(): Date | null {
    return this.#archivedAt;
  }

  get version(): number {
    return this.#version;
  }

  get events(): readonly WorkflowEvent[] {
    return this.#events;
  }

  clearEvents(): void {
    this.#events = [];
  }

  // The same version again is the one already published; a new version needs an active
  // workflow and becomes its current one (FR-004).
  publish(input: NewPublication): Result<Publication, WorkflowRefusal> {
    const own = input.definition.name.equals(this.#name);

    if (!own) throw new TypeError('The definition belongs to another workflow');

    const existing = input.existing;

    if (existing) return existing.republish(input.definition);

    if (this.#isArchived())
      return { ok: false, failure: WorkflowRefusal.Archived };

    const version = WorkflowVersion.publish(this.#id, input);
    this.#currentVersionId = version.id;

    // The new version's schedule replaces the previous one (US4 AS4).
    if (this.#on) this.#raise(WorkflowEventKind.ScheduleChanged);

    return { ok: true, value: { version, created: true } };
  }

  // Whether archiving changed the workflow: an archived one stays as it was, and is off.
  archive(now: Date): boolean {
    if (this.#isArchived()) return false;

    this.#status = WorkflowStatus.Archived;
    this.#archivedAt = now;
    this.turnOff();
    return true;
  }

  // Whether turning on changed the workflow; an archived one starts nothing by itself.
  turnOn(): Result<boolean, WorkflowRefusal> {
    if (this.#isArchived())
      return { ok: false, failure: WorkflowRefusal.Archived };

    if (this.#on) return { ok: true, value: false };

    this.#on = true;
    this.#raise(WorkflowEventKind.ScheduleChanged);
    return { ok: true, value: true };
  }

  // Whether turning off changed the workflow; running instances and manual starts go on.
  turnOff(): boolean {
    if (!this.#on) return false;

    this.#on = false;
    this.#raise(WorkflowEventKind.ScheduleChanged);
    return true;
  }

  startInstance(input: NewInstance): Result<WorkflowInstance, WorkflowRefusal> {
    const own = input.version.workflowId === this.#id;

    if (!own) throw new TypeError('The version belongs to another workflow');

    if (this.#isArchived())
      return { ok: false, failure: WorkflowRefusal.Archived };

    const id = randomUUID();
    const instance = WorkflowInstance.start(id, this.#id, input);
    return { ok: true, value: instance };
  }

  // Only while the workflow is on does its current version's schedule start instances
  // (FR-006); an occurrence of an earlier version's schedule starts none.
  startScheduledInstance(
    start: ScheduledStart,
  ): Result<WorkflowInstance, WorkflowRefusal> {
    const own = start.version.workflowId === this.#id;

    if (!own) throw new TypeError('The version belongs to another workflow');

    if (!this.#on || start.version.id !== this.#currentVersionId)
      return { ok: false, failure: WorkflowRefusal.Off };

    const id = start.instanceId ?? randomUUID();
    const instance = WorkflowInstance.start(id, this.#id, {
      version: start.version,
      input: start.input,
      trigger: start.trigger,
      starterId: null,
      originId: null,
      now: start.now,
    });
    return { ok: true, value: instance };
  }

  // A new instance of an ended one, on its version and with its input; the ended one stays
  // as it was.
  restartInstance(
    restart: InstanceRestart,
  ): Result<WorkflowInstance, StartRefusal> {
    const previous = restart.previous;
    const own =
      previous.workflowId === this.#id &&
      restart.version.id === previous.versionId;

    if (!own)
      throw new TypeError('The instance runs another workflow or version');

    if (!previous.ended)
      return { ok: false, failure: InstanceRefusal.NotEnded };

    return this.startInstance({
      version: restart.version,
      input: previous.input,
      trigger: TriggerKind.Restart,
      starterId: restart.starterId,
      originId: previous.id,
      now: restart.now,
    });
  }

  #isArchived(): boolean {
    return this.#status === WorkflowStatus.Archived;
  }

  #raise(kind: WorkflowEventKind): void {
    this.#events.push({ kind, workflowId: this.#id });
  }
}
