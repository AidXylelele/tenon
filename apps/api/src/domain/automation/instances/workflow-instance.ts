import type { Result } from '../../result.js';
import type { JsonObject, JsonValue } from '../json.js';
import type { NewInstance } from '../workflows/interfaces.js';
import {
  InstanceEventKind,
  InstanceRefusal,
  Phase,
  RunDirective,
  TriggerKind,
} from './enums.js';
import type { InstanceEvent, WorkflowInstanceProps } from './interfaces.js';

// An execution of a workflow version. The runtime executes its tasks; the instance keeps the
// standard's phases and decides what users may do with it.
export class WorkflowInstance {
  static readonly #ENDED = [Phase.Completed, Phase.Faulted, Phase.Cancelled];
  static readonly #SUSPENDABLE = [Phase.Running, Phase.Waiting];

  readonly #id: string;
  readonly #workflowId: string;
  readonly #versionId: string;
  readonly #trigger: TriggerKind;
  readonly #starterId: string | null;
  readonly #originId: string | null;
  readonly #input: JsonValue;
  readonly #createdAt: Date;
  readonly #version: number;
  #phase: Phase;
  #output: JsonValue | null;
  #error: JsonObject | null;
  #startedAt: Date | null;
  #endedAt: Date | null;
  #waiting: boolean;
  #events: InstanceEvent[] = [];

  constructor(props: WorkflowInstanceProps) {
    this.#id = props.id;
    this.#workflowId = props.workflowId;
    this.#versionId = props.versionId;
    this.#trigger = props.trigger;
    this.#starterId = props.starterId;
    this.#originId = props.originId;
    this.#input = props.input;
    this.#phase = props.phase;
    this.#output = props.output;
    this.#error = props.error;
    this.#createdAt = props.createdAt;
    this.#startedAt = props.startedAt;
    this.#endedAt = props.endedAt;
    this.#waiting = props.waiting;
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
      input: input.input,
      phase: Phase.Pending,
      output: null,
      error: null,
      createdAt: input.now,
      startedAt: null,
      endedAt: null,
      waiting: false,
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

  get version(): number {
    return this.#version;
  }

  // Whether the run is in a wait or a listen, which a suspension does not end.
  get waiting(): boolean {
    return this.#waiting;
  }

  get ended(): boolean {
    return WorkflowInstance.#ENDED.includes(this.#phase);
  }

  // Only a completed instance its schedule started continues an `after` chain; a faulted or
  // cancelled one ends it (US4 AS2).
  get continuesSchedule(): boolean {
    return (
      this.#trigger === TriggerKind.Schedule && this.#phase === Phase.Completed
    );
  }

  get events(): readonly InstanceEvent[] {
    return this.#events;
  }

  clearEvents(): void {
    this.#events = [];
  }

  // What the runtime does after a task: nothing more once the instance ended, and nothing
  // until a resume while it is suspended.
  directive(): RunDirective {
    if (this.ended) return RunDirective.Stop;

    if (this.#phase === Phase.Suspended) return RunDirective.Suspend;

    return RunDirective.Continue;
  }

  // The runtime picked the instance up.
  begin(now: Date): void {
    if (this.#phase !== Phase.Pending) return;

    this.#phase = Phase.Running;
    this.#startedAt = now;
    this.#raise(InstanceEventKind.Started);
  }

  // A wait or a listen began; the runtime reports it, and only a running instance waits.
  beginWaiting(): void {
    if (this.ended) return;

    this.#waiting = true;

    if (this.#phase === Phase.Running) this.#phase = Phase.Waiting;
  }

  endWaiting(): void {
    if (this.ended) return;

    this.#waiting = false;

    if (this.#phase === Phase.Waiting) this.#phase = Phase.Running;
  }

  // Outcomes are facts the runtime reports: never refused, ignored once the instance ended.
  complete(output: JsonValue, now: Date): void {
    if (this.ended) return;

    this.#phase = Phase.Completed;
    this.#output = output;
    this.#endedAt = now;
    this.#raise(InstanceEventKind.Completed);
  }

  fault(error: JsonObject, now: Date): void {
    if (this.ended) return;

    this.#phase = Phase.Faulted;
    this.#error = error;
    this.#endedAt = now;
    this.#raise(InstanceEventKind.Faulted);
  }

  // A user's requests (US9): each is refused unless the instance is in a phase that allows it.
  suspend(): Result<void, InstanceRefusal> {
    const suspendable = WorkflowInstance.#SUSPENDABLE.includes(this.#phase);

    if (!suspendable) return { ok: false, failure: InstanceRefusal.NotRunning };

    this.#phase = Phase.Suspended;
    this.#raise(InstanceEventKind.Suspended);
    return { ok: true, value: undefined };
  }

  resume(): Result<void, InstanceRefusal> {
    if (this.#phase !== Phase.Suspended)
      return { ok: false, failure: InstanceRefusal.NotSuspended };

    this.#phase = this.#waiting ? Phase.Waiting : Phase.Running;
    this.#raise(InstanceEventKind.Resumed);
    return { ok: true, value: undefined };
  }

  cancel(now: Date): Result<void, InstanceRefusal> {
    if (this.ended) return { ok: false, failure: InstanceRefusal.Ended };

    this.#phase = Phase.Cancelled;
    this.#endedAt = now;
    this.#raise(InstanceEventKind.Cancelled);
    return { ok: true, value: undefined };
  }

  // Only an ended instance's history may go.
  delete(): Result<void, InstanceRefusal> {
    if (!this.ended) return { ok: false, failure: InstanceRefusal.NotEnded };

    const told = this.#events.some(
      (event) => event.kind === InstanceEventKind.Deleted,
    );

    if (!told) this.#raise(InstanceEventKind.Deleted);

    return { ok: true, value: undefined };
  }

  #raise(kind: InstanceEventKind): void {
    const event = { kind, instanceId: this.#id };
    this.#events.push(event);
  }
}
