import type {
  EffectId,
  EffectResponse,
  Step,
  StepContext,
} from "../api/index.js";
import type { Program } from "../core/index.js";
import { InterpreterError, Raised } from "../runtime/index.js";
import { type InterruptedFrame, interrupted } from "./cancel/index.js";
import { checkAwaiting, responded } from "./effects/index.js";
import { evaluated } from "./evaluate/index.js";
import {
  type AgendaItem,
  FiberTable,
  type ReadyFiber,
  lapsedOwnerOf,
  ownerOf,
} from "./fibers/index.js";
import {
  type FiberId,
  type RunRecord,
  type Store,
  runRecordOf,
} from "./registers/index.js";
import { raised, raisedFromRule } from "./raise/index.js";
import { returned } from "./return/index.js";
import { type Snapshot, snapshotOf } from "./state/index.js";
import { type Outputs, StepOutputs } from "./step-outputs.js";
import type { Owner } from "./time/index.js";
import type {
  Control,
  Next,
  RunResult,
  Transition,
  Write,
} from "./transitions/index.js";
import type { MachineServices, RunnerStatics, View } from "./view.js";

export interface Setting {
  readonly program: Program;
  readonly services: MachineServices;
  readonly statics: RunnerStatics;
  readonly context: StepContext;
}

export interface MachineOutcome extends Outputs {
  readonly snapshot: Snapshot;
}

type Leaving = Exclude<Next, Control>;

interface NoneRunning {
  readonly kind: "none";
}

interface FiberRunning {
  readonly kind: "fiber";
  readonly fiber: FiberId;
}

type RunningFiber = NoneRunning | FiberRunning;

const noneRunning: NoneRunning = { kind: "none" };

type RunWrite = Extract<
  Write,
  { readonly kind: "started" | "suspended" | "resumed" | "queued" }
>;

export class Machine implements View {
  readonly program: Program;
  readonly services: MachineServices;
  readonly statics: RunnerStatics;
  readonly context: StepContext;
  readonly #fibers: FiberTable;
  readonly #outputs = new StepOutputs();
  #run: RunRecord;
  #store: Store;
  #status: Step["status"];
  #queued: readonly EffectResponse[];
  #result: Snapshot["result"];
  #running: RunningFiber = noneRunning;

  constructor(snapshot: Snapshot, setting: Setting) {
    this.program = setting.program;
    this.services = setting.services;
    this.statics = setting.statics;
    this.context = setting.context;
    this.#run = snapshot.run;
    this.#fibers = new FiberTable(snapshot.fibers, snapshot.nextFiber);
    this.#queued = snapshot.queued;
    this.#store = snapshot.store;
    this.#status = snapshot.status;
    this.#result = snapshot.result;
  }

  get run(): RunRecord {
    return this.#run;
  }

  get store(): Store {
    return this.#store;
  }

  get nextFiber(): FiberId {
    return this.#fibers.next;
  }

  deadline(): Owner {
    const running = this.#runningFiber("no deadline encloses one");
    const chain = this.#fibers.chainOf(running);

    return ownerOf(chain);
  }

  isAnswerHeld(id: EffectId): boolean {
    const running = this.#runningFiber("no answer is held for one");
    const isQueued = this.#queued.some((response) => response.id === id);
    const isReady = this.#fibers.hasAnswerFor(running);
    const isHeld = isQueued || isReady;

    return isHeld;
  }

  runFibers(
    prelude: readonly Write[],
    agenda: readonly AgendaItem[],
  ): MachineOutcome {
    this.#writtenAll(prelude);

    for (const item of agenda) {
      this.#scheduled(item);
    }

    this.#drained();
    return this.#outcome();
  }

  #scheduled(item: AgendaItem): void {
    switch (item.kind) {
      case "run":
        this.#fibers.readied(item);
        return;
      case "lapse":
        this.#lapsed();
        return;
    }
  }

  #lapsed(): void {
    for (;;) {
      this.#drained();

      const fibers = this.#fibers.held();
      const owner = lapsedOwnerOf(fibers, this.context.now);

      if (owner.kind === "none") {
        return;
      }

      this.#fibers.expired(owner);
    }
  }

  #drained(): void {
    for (
      let ready = this.#fibers.nextReady();
      ready !== undefined;
      ready = this.#fibers.nextReady()
    ) {
      this.#runFiber(ready);
    }
  }

  #runFiber(ready: ReadyFiber): void {
    const fiber = ready.fiber;
    const leaving = this.#trampolined(ready);

    switch (leaving.kind) {
      case "suspend": {
        const suspended = this.#fibers.fiber(fiber);
        checkAwaiting(suspended);
        return;
      }
      case "fork":
        this.#fibers.forked(fiber, leaving.branches);
        return;
      case "end":
        this.#fibers.ended(fiber, leaving.report);
        return;
      case "expire":
        this.#fibers.expired(leaving.owner);
        return;
      case "unwind":
        this.#fibers.unwound(fiber, leaving);
        return;
      case "gone":
        this.#fibers.removed(fiber);
        return;
      case "finish":
        this.#finished(fiber, leaving.result);
        return;
    }
  }

  #trampolined(ready: ReadyFiber): Leaving {
    this.#running = { kind: "fiber", fiber: ready.fiber };

    for (let next: Next = ready.control; ; next = this.#stepped(next)) {
      switch (next.kind) {
        case "evaluate":
        case "return":
        case "raise":
        case "respond":
        case "interrupt":
          break;
        case "suspend":
        case "fork":
        case "end":
        case "finish":
        case "expire":
        case "unwind":
        case "gone":
          this.#running = noneRunning;
          return next;
      }
    }
  }

  #stepped(control: Control): Next {
    const fiber = this.#runningFiber("no judgment has a fiber to run in");
    const transition = this.#transitionOf(fiber, control);

    this.#applied(fiber, transition);
    return transition.next;
  }

  #transitionOf(fiber: FiberId, control: Control): Transition {
    try {
      return this.#judged(fiber, control);
    } catch (thrown) {
      const isWorkflowError = thrown instanceof Raised;

      if (!isWorkflowError) {
        throw thrown;
      }

      return raisedFromRule(control, thrown.error);
    }
  }

  #judged(fiber: FiberId, control: Control): Transition {
    switch (control.kind) {
      case "evaluate":
        return evaluated(control, this);
      case "return": {
        const frame = this.#fibers.popped(fiber);
        return returned(frame, control.completion, this);
      }
      case "raise": {
        const frame = this.#fibers.popped(fiber);
        return raised(frame, control.error, this);
      }
      case "respond": {
        const frame = this.#fibers.popped(fiber);
        return responded(frame, control.outcome, this);
      }
      case "interrupt": {
        const depth = this.#fibers.depthOf(fiber);
        const frame = this.#fibers.popped(fiber);
        const popped: InterruptedFrame = { frame, depth };
        return interrupted(popped, control, this);
      }
    }
  }

  #runningFiber(reading: string): FiberId {
    const running = this.#running;

    switch (running.kind) {
      case "none":
        throw new InterpreterError(`No fiber runs, so ${reading}.`);
      case "fiber":
        return running.fiber;
    }
  }

  #applied(id: FiberId, transition: Transition): void {
    this.#fibers.pushed(id, transition.push);
    this.#writtenAll(transition.writes);
  }

  #writtenAll(writes: readonly Write[]): void {
    for (const write of writes) {
      this.#written(write);
    }
  }

  #written(write: Write): void {
    switch (write.kind) {
      case "allocated":
        this.#store = this.#store.allocated(write.activation);
        return;
      case "updated":
        this.#store = this.#store.updated(write.address, write.activation);
        return;
      case "freed":
        this.#store = this.#store.freed(write.address);
        return;
      case "committed":
        this.#store = this.#store.committed(write.context);
        return;
      case "started":
      case "suspended":
      case "resumed":
      case "queued":
        this.#runWritten(write);
        return;
      case "reported":
      case "taken":
      case "given":
      case "requested":
      case "withdrawn":
      case "declined":
        this.#outputs.recorded(write);
        return;
    }
  }

  #runWritten(write: RunWrite): void {
    switch (write.kind) {
      case "started":
        this.#run = runRecordOf(this.#run.instance, write.input, write.at);
        return;
      case "suspended":
        this.#status = "suspended";
        return;
      case "resumed":
        this.#status = "running";
        this.#queued = [];
        return;
      case "queued":
        this.#queued = [...this.#queued, write.response];
        return;
    }
  }

  #finished(fiber: FiberId, result: RunResult): void {
    this.#result = result;
    this.#status = result.kind;
    this.#queued = [];
    this.#fibers.finished(fiber);
  }

  #outcome(): MachineOutcome {
    const fibers = this.#fibers.held();
    const outputs = this.#outputs.copied();
    const snapshot = snapshotOf({
      run: this.#run,
      status: this.#status,
      store: this.#store,
      fibers,
      nextFiber: this.#fibers.next,
      queued: this.#queued,
      result: this.#result,
    });

    return {
      snapshot,
      events: outputs.events,
      taskInputs: outputs.taskInputs,
      taskOutputs: outputs.taskOutputs,
      requested: outputs.requested,
      withdrawn: outputs.withdrawn,
      declined: outputs.declined,
    };
  }
}
