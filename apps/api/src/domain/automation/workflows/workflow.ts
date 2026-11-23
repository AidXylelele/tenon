import { randomUUID } from "node:crypto";
import type { Result } from "../../interfaces.js";
import { Control, TriggerKind } from "../instances/enums.js";
import { WorkflowInstance } from "../instances/workflow-instance.js";
import { WorkflowEventKind, WorkflowRefusal, WorkflowStatus } from "./enums.js";
import type {
  ChildStart,
  InstanceRestart,
  NewInstance,
  NewPublication,
  FiredStart,
  Publication,
  ScheduledStart,
  ScheduleFire,
  StartRefusal,
  VersionPublication,
  WorkflowEvent,
  WorkflowProps,
} from "./interfaces.js";
import type { Schedule } from "./schedule.js";
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
  #arming: number;
  #scheduledSince: Date | null;
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
    this.#arming = props.arming;
    this.#scheduledSince = props.scheduledSince;
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
      arming: 0,
      scheduledSince: null,
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

  get arming(): number {
    return this.#arming;
  }

  get scheduledSince(): Date | null {
    return this.#scheduledSince;
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
    this.#add(version, input);
    this.#currentVersionId = version.id;

    if (this.#on) this.#applySchedule(input.now);

    return { ok: true, value: { version, created: true } };
  }

  testDraft(input: NewPublication): Result<Publication, WorkflowRefusal> {
    const definition = input.definition;
    const own = definition.name.equals(this.#name);

    if (!own) throw new TypeError("The definition belongs to another workflow");

    const archived = this.#isArchived();

    if (archived) return { ok: false, failure: WorkflowRefusal.Archived };

    const tested = this.#versions.find((version) =>
      version.isTestOf(definition, input.publisherId),
    );

    if (tested !== undefined)
      return { ok: true, value: { version: tested, created: false } };

    const version = WorkflowVersion.forTest(input);
    this.#add(version, input);
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

  archive(now: Date): Result<boolean, WorkflowRefusal> {
    const unpublished = this.#currentVersionId === null;

    if (unpublished) return { ok: false, failure: WorkflowRefusal.Unpublished };

    const archived = this.#isArchived();

    if (archived) return { ok: true, value: false };

    this.#status = WorkflowStatus.Archived;
    this.#archivedAt = now;
    this.turnOff();
    return { ok: true, value: true };
  }

  turnOn(now: Date): Result<boolean, WorkflowRefusal> {
    const unpublished = this.#currentVersionId === null;

    if (unpublished) return { ok: false, failure: WorkflowRefusal.Unpublished };

    const archived = this.#isArchived();

    if (archived) return { ok: false, failure: WorkflowRefusal.Archived };

    if (this.#on) return { ok: true, value: false };

    this.#on = true;
    this.#applySchedule(now);
    return { ok: true, value: true };
  }

  turnOff(): boolean {
    if (!this.#on) return false;

    this.#on = false;
    this.#scheduledSince = null;
    this.#disarm();
    return true;
  }

  fireSchedule(fire: ScheduleFire): boolean {
    const schedule = this.#schedule();

    if (fire.arming !== this.#arming || schedule === null) return false;

    this.#events.push({
      kind: WorkflowEventKind.ScheduleFired,
      workflowId: this.#id,
      at: fire.at,
    });
    const following = schedule.followingAt(fire.now);
    this.#armAt(following);
    return true;
  }

  startFiredInstance(
    start: FiredStart,
  ): Result<WorkflowInstance, WorkflowRefusal> {
    const version = this.scheduledVersion;

    if (version === null || version.schedule === null)
      return { ok: false, failure: WorkflowRefusal.Off };

    return this.startScheduledInstance({
      instanceId: start.instanceId,
      version,
      input: {},
      trigger: TriggerKind.Schedule,
      chainRunning: start.chainRunning,
      lifecycleOf: null,
      now: start.now,
    });
  }

  continueSchedule(instance: WorkflowInstance, now: Date): boolean {
    const own = instance.workflowId === this.#id;

    if (!own || !instance.continuesSchedule) return false;

    const at = this.#schedule()?.continuedAt(now) ?? null;

    if (at === null) return false;

    this.#armAt(at);
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

  startChild(start: ChildStart): Result<WorkflowInstance, WorkflowRefusal> {
    const version = this.versionToRun(start.version);

    if (version === null)
      return { ok: false, failure: WorkflowRefusal.Unpublished };

    return this.startInstance({
      instanceId: start.instanceId,
      version,
      input: start.input,
      trigger: start.trigger,
      starterId: null,
      origin: start.parent,
      originEffectId: start.effectId,
      now: start.now,
    });
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

    const chained = start.version.schedule?.chained ?? false;

    if (chained && start.chainRunning)
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
      origin: null,
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
      origin: previous,
      originEffectId: null,
      now: restart.now,
    });
  }

  #add(version: WorkflowVersion, input: NewPublication): void {
    const definition = input.definition;
    this.#versions = this.#versions.concat([version]);
    this.#publications.push({
      version,
      document: definition.document,
      imports: definition.imports,
      source: input.source,
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
    const found = this.#versions.find((version) => version.isNumbered(semver));
    return found ?? null;
  }

  #currentVersion(): WorkflowVersion | null {
    const id = this.#currentVersionId;

    if (id === null) return null;

    return this.versionById(id);
  }

  #schedule(): Schedule | null {
    return this.scheduledVersion?.schedule ?? null;
  }

  #applySchedule(now: Date): void {
    const at = this.#schedule()?.armedAt(now) ?? null;
    this.#scheduledSince = now;
    this.#armAt(at);
  }

  #disarm(): void {
    this.#arming += 1;
  }

  #armAt(at: number | null): void {
    this.#disarm();

    if (at === null) return;

    this.#events.push({
      kind: WorkflowEventKind.ScheduleArmed,
      workflowId: this.#id,
      arming: this.#arming,
      at,
    });
  }
}
