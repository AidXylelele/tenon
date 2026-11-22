import { randomUUID } from "node:crypto";
import type { Result } from "../../interfaces.js";
import { Control, TriggerKind } from "../instances/enums.js";
import { WorkflowInstance } from "../instances/workflow-instance.js";
import { WorkflowEventKind, WorkflowRefusal, WorkflowStatus } from "./enums.js";
import type {
  InstanceRestart,
  NewInstance,
  NewPublication,
  Publication,
  ScheduledStart,
  StartRefusal,
  VersionPublication,
  WorkflowEvent,
  WorkflowProps,
} from "./interfaces.js";
import type { WorkflowName } from "./workflow-name.js";
import { WorkflowVersion } from "./workflow-version.js";

export class Workflow {
  readonly #id: string;
  readonly #name: WorkflowName;
  readonly #version: number;
  #status: WorkflowStatus;
  #on: boolean;
  #currentVersionId: string | null;
  #archivedAt: Date | null;
  #versions: readonly WorkflowVersion[];
  #publications: VersionPublication[] = [];
  #events: WorkflowEvent[] = [];

  constructor(props: WorkflowProps) {
    this.#id = props.id;
    this.#name = props.name;
    this.#status = props.status;
    this.#on = props.on;
    this.#currentVersionId = props.currentVersionId;
    this.#archivedAt = props.archivedAt;
    this.#version = props.version;
    this.#versions = props.versions;
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
      versions: [],
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

  get publications(): readonly VersionPublication[] {
    return this.#publications;
  }

  get events(): readonly WorkflowEvent[] {
    return this.#events;
  }

  clearPublications(): void {
    this.#publications = [];
  }

  clearEvents(): void {
    this.#events = [];
  }

  publish(input: NewPublication): Result<Publication, WorkflowRefusal> {
    const definition = input.definition;
    const own = definition.name.equals(this.#name);

    if (!own) throw new TypeError("The definition belongs to another workflow");

    const taken = this.#versionAt(definition.version);

    if (taken !== null) return taken.republish(definition);

    const archived = this.#isArchived();

    if (archived) return { ok: false, failure: WorkflowRefusal.Archived };

    const version = WorkflowVersion.publish(input);
    this.#versions = this.#versions.concat([version]);
    this.#publications.push({
      version,
      document: definition.document,
      imports: definition.imports,
      source: input.source,
    });
    this.#currentVersionId = version.id;

    if (this.#on) this.#raise(WorkflowEventKind.ScheduleChanged);

    return { ok: true, value: { version, created: true } };
  }

  versionToRun(semver: string | null): WorkflowVersion | null {
    if (semver !== null) return this.#versionAt(semver);

    return this.#currentVersion();
  }

  versionById(id: string): WorkflowVersion | null {
    const found = this.#versions.find((version) => version.id === id);
    return found ?? null;
  }

  archive(now: Date): boolean {
    const archived = this.#isArchived();

    if (archived) return false;

    this.#status = WorkflowStatus.Archived;
    this.#archivedAt = now;
    this.turnOff();
    return true;
  }

  turnOn(): Result<boolean, WorkflowRefusal> {
    const archived = this.#isArchived();

    if (archived) return { ok: false, failure: WorkflowRefusal.Archived };

    if (this.#on) return { ok: true, value: false };

    this.#on = true;
    this.#raise(WorkflowEventKind.ScheduleChanged);
    return { ok: true, value: true };
  }

  turnOff(): boolean {
    if (!this.#on) return false;

    this.#on = false;
    this.#raise(WorkflowEventKind.ScheduleChanged);
    return true;
  }

  startInstance(input: NewInstance): Result<WorkflowInstance, WorkflowRefusal> {
    const own = this.#owns(input.version);

    if (!own) throw new TypeError("The version belongs to another workflow");

    const archived = this.#isArchived();

    if (archived) return { ok: false, failure: WorkflowRefusal.Archived };

    const id = input.instanceId ?? randomUUID();
    const instance = WorkflowInstance.start(id, this.#id, input);
    return { ok: true, value: instance };
  }

  get scheduledVersion(): WorkflowVersion | null {
    if (!this.#on) return null;

    return this.#currentVersion();
  }

  startScheduledInstance(
    start: ScheduledStart,
  ): Result<WorkflowInstance, WorkflowRefusal> {
    const own = this.#owns(start.version);

    if (!own) throw new TypeError("The version belongs to another workflow");

    const scheduled = this.scheduledVersion;

    if (scheduled?.id !== start.version.id)
      return { ok: false, failure: WorkflowRefusal.Off };

    if (start.chained && start.chainRunning)
      return { ok: false, failure: WorkflowRefusal.ChainRunning };

    if (start.lifecycleOf === this.#id)
      return { ok: false, failure: WorkflowRefusal.OwnLifecycle };

    const id = start.instanceId ?? randomUUID();
    const instance = WorkflowInstance.start(id, this.#id, {
      instanceId: id,
      version: start.version,
      input: start.input,
      trigger: start.trigger,
      starterId: null,
      originId: null,
      originEffectId: null,
      now: start.now,
    });
    return { ok: true, value: instance };
  }

  restartInstance(
    restart: InstanceRestart,
  ): Result<WorkflowInstance, StartRefusal> {
    const previous = restart.previous;
    const own =
      previous.workflowId === this.#id &&
      restart.version.id === previous.versionId;

    if (!own)
      throw new TypeError("The instance runs another workflow or version");

    const admitted = previous.admits(Control.Restart);

    if (!admitted.ok) return admitted;

    return this.startInstance({
      instanceId: null,
      version: restart.version,
      input: previous.input,
      trigger: TriggerKind.Restart,
      starterId: restart.starterId,
      originId: previous.id,
      originEffectId: null,
      now: restart.now,
    });
  }

  #isArchived(): boolean {
    return this.#status === WorkflowStatus.Archived;
  }

  #owns(version: WorkflowVersion): boolean {
    const found = this.versionById(version.id);
    return found !== null;
  }

  #versionAt(semver: string): WorkflowVersion | null {
    const found = this.#versions.find((version) => version.semver === semver);
    return found ?? null;
  }

  #currentVersion(): WorkflowVersion | null {
    const id = this.#currentVersionId;

    if (id === null) return null;

    return this.versionById(id);
  }

  #raise(kind: WorkflowEventKind): void {
    this.#events.push({ kind, workflowId: this.#id });
  }
}
