import type { Result } from "../../interfaces.js";
import type { JsonObject, JsonValue } from "../interfaces.js";
import type { RunSecrets } from "../secrets/run-secrets.js";
import type { NewInstance } from "../workflows/interfaces.js";
import {
  CancelReason,
  Control,
  InstanceEventKind,
  InstanceRefusal,
  Phase,
  TriggerKind,
  TurnStatus,
} from "./enums.js";
import type {
  EventOffer,
  InstanceEvent,
  LifecycleEvent,
  Listening,
  PlayedTurn,
  Receiving,
  RunAgenda,
  RunEnding,
  RunTurn,
  RunWait,
  TaskValue,
  WorkflowInstanceProps,
} from "./interfaces.js";
import { Run } from "./run.js";

export class WorkflowInstance {
  static readonly #ENDED = [Phase.Completed, Phase.Faulted, Phase.Cancelled];
  static readonly #SUSPENDABLE = [Phase.Running, Phase.Waiting];

  readonly #id: string;
  readonly #workflowId: string;
  readonly #versionId: string;
  readonly #trigger: TriggerKind;
  readonly #starterId: string | null;
  readonly #originId: string | null;
  readonly #originEffectId: string | null;
  readonly #input: JsonValue;
  readonly #createdAt: Date;
  readonly #version: number;
  #phase: Phase;
  #output: JsonValue | null;
  #error: JsonObject | null;
  #startedAt: Date | null;
  #endedAt: Date | null;
  #cancelReason: CancelReason | null;
  #run: Run | null;
  #events: InstanceEvent[] = [];
  #lifecycle: LifecycleEvent[] = [];
  #taskValues: TaskValue[] = [];

  constructor(props: WorkflowInstanceProps) {
    this.#id = props.id;
    this.#workflowId = props.workflowId;
    this.#versionId = props.versionId;
    this.#trigger = props.trigger;
    this.#starterId = props.starterId;
    this.#originId = props.originId;
    this.#originEffectId = props.originEffectId;
    this.#input = props.input;
    this.#phase = props.phase;
    this.#output = props.output;
    this.#error = props.error;
    this.#createdAt = props.createdAt;
    this.#startedAt = props.startedAt;
    this.#endedAt = props.endedAt;
    this.#cancelReason = props.cancelReason;
    this.#run = props.run;
    this.#version = props.version;
  }

  static start(
    id: string,
    workflowId: string,
    input: NewInstance,
  ): WorkflowInstance {
    return new WorkflowInstance({
      id,
      workflowId,
      versionId: input.version.id,
      trigger: input.trigger,
      starterId: input.starterId,
      originId: input.originId,
      originEffectId: input.originEffectId,
      input: input.input,
      phase: Phase.Pending,
      output: null,
      error: null,
      createdAt: input.now,
      startedAt: null,
      endedAt: null,
      cancelReason: null,
      run: null,
      version: 0,
    });
  }

  get id(): string {
    return this.#id;
  }

  get workflowId(): string {
    return this.#workflowId;
  }

  get versionId(): string {
    return this.#versionId;
  }

  get trigger(): TriggerKind {
    return this.#trigger;
  }

  get starterId(): string | null {
    return this.#starterId;
  }

  get originId(): string | null {
    return this.#originId;
  }

  get originEffectId(): string | null {
    return this.#originEffectId;
  }

  get input(): JsonValue {
    return this.#input;
  }

  get phase(): Phase {
    return this.#phase;
  }

  get output(): JsonValue | null {
    return this.#output;
  }

  get error(): JsonObject | null {
    return this.#error;
  }

  get createdAt(): Date {
    return this.#createdAt;
  }

  get startedAt(): Date | null {
    return this.#startedAt;
  }

  get endedAt(): Date | null {
    return this.#endedAt;
  }

  get cancelReason(): CancelReason | null {
    return this.#cancelReason;
  }

  get run(): Run | null {
    return this.#run;
  }

  get version(): number {
    return this.#version;
  }

  get ended(): boolean {
    return WorkflowInstance.#ENDED.includes(this.#phase);
  }

  get pending(): boolean {
    return this.#phase === Phase.Pending;
  }

  get awaitedBy(): string | null {
    if (this.#trigger !== TriggerKind.Parent) return null;

    return this.#originId;
  }

  get continuesSchedule(): boolean {
    return (
      this.#trigger === TriggerKind.Schedule && this.#phase === Phase.Completed
    );
  }

  get agenda(): RunAgenda {
    const awaited = this.ended ? [] : (this.#run?.awaited ?? []);
    return { instanceId: this.#id, ended: this.ended, awaited };
  }

  get listening(): readonly Listening[] {
    if (this.ended) return [];

    return this.#run?.listening ?? [];
  }

  get receiving(): readonly Receiving[] {
    if (this.ended) return [];

    return this.#run?.receiving ?? [];
  }

  get waits(): readonly RunWait[] {
    if (this.ended) return [];

    return this.#run?.waits ?? [];
  }

  get events(): readonly InstanceEvent[] {
    return this.#events;
  }

  get lifecycle(): readonly LifecycleEvent[] {
    return this.#lifecycle;
  }

  get taskValues(): readonly TaskValue[] {
    return this.#taskValues;
  }

  clearEvents(): void {
    this.#events = [];
    this.#lifecycle = [];
    this.#taskValues = [];
  }

  receives(execution: string): boolean {
    return this.receiving.some((receive) => receive.execution === execution);
  }

  awaits(effectId: string): boolean {
    if (this.ended || this.#run === null) return false;

    return this.#run.awaits(effectId);
  }

  mayTake(offer: EventOffer): boolean {
    if (this.ended || this.#run === null) return false;

    return this.#run.mayTake(offer);
  }

  awaitsChild(child: WorkflowInstance): boolean {
    const effectId = child.originEffectId;

    if (child.awaitedBy !== this.#id || effectId === null) return false;

    return this.awaits(effectId);
  }

  abandons(child: WorkflowInstance): boolean {
    if (child.awaitedBy !== this.#id) return false;

    const awaited = this.awaitsChild(child);
    return !awaited;
  }

  static controlsIn(phase: Phase): Control[] {
    const controls = Object.values(Control);
    return controls.filter((control) => {
      const refusal = WorkflowInstance.#refusalIn(phase, control);
      return refusal === null;
    });
  }

  admits(control: Control): Result<void, InstanceRefusal> {
    const refusal = WorkflowInstance.#refusalIn(this.#phase, control);

    if (refusal !== null) return { ok: false, failure: refusal };

    return { ok: true, value: undefined };
  }

  masked(event: JsonObject, secrets: RunSecrets): JsonObject {
    const past = this.#run?.secretTexts ?? [];
    return secrets.maskObject(event, past);
  }

  begin(turn: RunTurn, secrets: RunSecrets, now: Date): void {
    if (this.#phase !== Phase.Pending) return;

    this.#startedAt = now;
    this.#run = Run.begun(turn, secrets);
    this.#take(turn, secrets, this.#run, now);
  }

  advance(turn: PlayedTurn, secrets: RunSecrets, now: Date): void {
    if (this.ended || this.#run === null) return;

    if (turn.status === TurnStatus.Stranded) {
      this.#cancelStranded(turn.ending, now);
      return;
    }

    this.#run = this.#run.after(turn, secrets);
    this.#take(turn, secrets, this.#run, now);
  }

  cancel(now: Date): void {
    if (this.ended) return;

    this.#end(Phase.Cancelled, now);
  }

  fail(ending: RunEnding, now: Date): void {
    if (this.ended) return;

    this.#error = ending.error;
    this.#tell(ending);
    this.#end(Phase.Faulted, now);
  }

  delete(): Result<void, InstanceRefusal> {
    const admitted = this.admits(Control.Delete);

    if (!admitted.ok) return admitted;

    const told = this.#events.some(
      (event) => event.kind === InstanceEventKind.Deleted,
    );

    if (!told) this.#raise(InstanceEventKind.Deleted);

    return admitted;
  }

  #cancelStranded(ending: RunEnding, now: Date): void {
    this.#cancelReason = CancelReason.InterpreterChanged;
    this.#tell(ending);
    this.#end(Phase.Cancelled, now);
  }

  #take(turn: RunTurn, secrets: RunSecrets, run: Run, now: Date): void {
    const past = run.secretTexts;

    for (const event of turn.events) {
      const data = secrets.maskObject(event.data, past);
      const masked = {
        name: event.name,
        types: event.types,
        data,
        execution: event.execution,
      };
      this.#lifecycle.push(masked);
    }

    for (const taskValue of turn.taskValues) {
      const value = secrets.mask(taskValue.value, past);
      const masked = {
        execution: taskValue.execution,
        kind: taskValue.kind,
        value,
      };
      this.#taskValues.push(masked);
    }

    if (turn.abandoned.length > 0)
      this.#raise(InstanceEventKind.ChildrenAbandoned);

    switch (turn.status) {
      case TurnStatus.Running:
        this.#phase = run.waiting ? Phase.Waiting : Phase.Running;
        return;
      case TurnStatus.Suspended:
        this.#phase = Phase.Suspended;
        return;
      case TurnStatus.Completed:
        this.#output = secrets.mask(turn.output, past);
        this.#end(Phase.Completed, now);
        return;
      case TurnStatus.Faulted: {
        const error = turn.error ?? {};
        this.#error = secrets.maskObject(error, past);
        this.#end(Phase.Faulted, now);
        return;
      }
      case TurnStatus.Cancelled:
        this.#end(Phase.Cancelled, now);
        return;
    }
  }

  #tell(ending: RunEnding): void {
    for (const event of ending.events) this.#lifecycle.push(event);
  }

  #end(phase: Phase, now: Date): void {
    this.#phase = phase;
    this.#endedAt = now;
    this.#raise(InstanceEventKind.Ended);
  }

  static #refusalIn(phase: Phase, control: Control): InstanceRefusal | null {
    switch (control) {
      case Control.Suspend:
        return WorkflowInstance.#suspendRefusalIn(phase);
      case Control.Resume:
        return WorkflowInstance.#resumeRefusalIn(phase);
      case Control.Cancel:
        return WorkflowInstance.#cancelRefusalIn(phase);
      case Control.Restart:
      case Control.Delete:
        return WorkflowInstance.#endedRefusalIn(phase);
    }
  }

  static #suspendRefusalIn(phase: Phase): InstanceRefusal | null {
    const suspendable = WorkflowInstance.#SUSPENDABLE.includes(phase);

    if (suspendable) return null;

    return InstanceRefusal.NotRunning;
  }

  static #resumeRefusalIn(phase: Phase): InstanceRefusal | null {
    if (phase === Phase.Suspended) return null;

    return InstanceRefusal.NotSuspended;
  }

  static #cancelRefusalIn(phase: Phase): InstanceRefusal | null {
    const ended = WorkflowInstance.#ENDED.includes(phase);

    if (ended) return InstanceRefusal.Ended;

    return null;
  }

  static #endedRefusalIn(phase: Phase): InstanceRefusal | null {
    const ended = WorkflowInstance.#ENDED.includes(phase);

    if (ended) return null;

    return InstanceRefusal.NotEnded;
  }

  #raise(kind: InstanceEventKind): void {
    const event = { kind, instanceId: this.#id, parentId: this.awaitedBy };
    this.#events.push(event);
  }
}
