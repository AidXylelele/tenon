import { randomUUID } from 'node:crypto';
import type { Result } from '../../result.js';
import { InstanceRefusal, TriggerKind } from '../instances/enums.js';
import { WorkflowInstance } from '../instances/workflow-instance.js';
import { WorkflowRefusal, WorkflowStatus } from './enums.js';
import type {
  InstanceRestart,
  NewInstance,
  NewPublication,
  Publication,
  StartRefusal,
  WorkflowProps,
} from './interfaces.js';
import type { WorkflowName } from './workflow-name.js';
import { WorkflowVersion } from './workflow-version.js';

export class Workflow {
  readonly #id: string;
  readonly #name: WorkflowName;
  readonly #version: number;
  #status: WorkflowStatus;
  #currentVersionId: string | null;
  #archivedAt: Date | null;

  constructor(props: WorkflowProps) {
    this.#id = props.id;
    this.#name = props.name;
    this.#status = props.status;
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

  get currentVersionId(): string | null {
    return this.#currentVersionId;
  }

  get archivedAt(): Date | null {
    return this.#archivedAt;
  }

  get version(): number {
    return this.#version;
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
    return { ok: true, value: { version, created: true } };
  }

  // Whether archiving changed the workflow: an archived one stays as it was.
  archive(now: Date): boolean {
    if (this.#isArchived()) return false;

    this.#status = WorkflowStatus.Archived;
    this.#archivedAt = now;
    return true;
  }

  startInstance(input: NewInstance): Result<WorkflowInstance, WorkflowRefusal> {
    const own = input.version.workflowId === this.#id;

    if (!own) throw new TypeError('The version belongs to another workflow');

    if (this.#isArchived())
      return { ok: false, failure: WorkflowRefusal.Archived };

    const instance = WorkflowInstance.start(this.#id, input);
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
}
