import { Stack } from "immutable";
import type {
  EffectResponse,
  InputProblem,
  JsonValue,
  Manifest,
  Program,
  StartContext,
  State,
  Step,
  StepContext,
} from "../api/index.js";
import type { Program as TranslatedProgram, Stream } from "../core/index.js";
import { InterpreterError } from "../runtime/index.js";
import type { Operation, Played, Telemetry } from "../telemetry/index.js";
import {
  admittedAnswerOf,
  answerOf,
  checkAdmitted,
  checkUnqueued,
} from "./effects/index.js";
import { problemsOf, workflowRootOf } from "./evaluate/index.js";
import {
  type AgendaItem,
  type ReadyFiber,
  fiberOf,
  lapsing,
} from "./fibers/index.js";
import { type Frame, triggerK } from "./frames/index.js";
import { rootPath } from "./identity/index.js";
import { resumedOf, suspendedOf, workflowBegunOf } from "./lifecycle/index.js";
import { Machine, type MachineOutcome, type Setting } from "./machine.js";
import { measureOf } from "./measure.js";
import {
  type Activation,
  type Address,
  type FiberId,
  type Here,
  type RunRecord,
  Store,
  activationOf,
  rootScopeOf,
  runRecordOf,
} from "./registers/index.js";
import {
  type Seal,
  type Snapshot,
  decodeState,
  snapshotOf,
  unended,
} from "./state/index.js";
import { staticsOf } from "./statics.js";
import { stepOf } from "./step.js";
import { cancelling, evaluating, queued } from "./transitions/index.js";
import type { MachineServices, RunnerStatics } from "./view.js";

const rootFiber: FiberId = 0;

type UnendedStatus = Extract<Step["status"], "running" | "suspended">;

interface OpenedRun {
  readonly run: RunRecord;
  readonly store: Store;
  readonly workflow: Address;
}

export class Runner implements Program {
  readonly #program: TranslatedProgram;
  readonly #services: MachineServices;
  readonly #statics: RunnerStatics;
  readonly #seal: Seal;
  readonly #telemetry: Telemetry;

  constructor(
    program: TranslatedProgram,
    services: MachineServices,
    telemetry: Telemetry,
  ) {
    const statics = staticsOf(program);

    this.#program = program;
    this.#services = services;
    this.#statics = statics;
    this.#seal = { terms: statics.terms, fingerprint: program.fingerprint };
    this.#telemetry = telemetry;
  }

  get manifest(): Manifest {
    return this.#program.manifest;
  }

  get fingerprint(): string {
    return this.#program.fingerprint;
  }

  inputProblemsOf(input: JsonValue): readonly InputProblem[] {
    const schema = this.#program.input;

    if (schema?.kind !== "compiled") {
      return [];
    }

    const validator = this.#program.schemas.get(schema.id);

    if (validator === undefined) {
      throw new InterpreterError(
        `The program compiled no schema '${schema.id}'.`,
      );
    }

    return problemsOf(validator, input);
  }

  start(input: JsonValue, context: StartContext): Step {
    return this.#played("start", context, () => this.#started(input, context));
  }

  correlate(context: StartContext): Step {
    return this.#played("correlate", context, () => this.#correlated(context));
  }

  respond(state: State, response: EffectResponse, context: StepContext): Step {
    return this.#played("respond", context, () =>
      this.#responded(state, response, context),
    );
  }

  suspend(state: State, context: StepContext): Step {
    return this.#played("suspend", context, () =>
      this.#suspended(state, context),
    );
  }

  resume(state: State, context: StepContext): Step {
    return this.#played("resume", context, () => this.#resumed(state, context));
  }

  cancel(state: State, context: StepContext): Step {
    return this.#played("cancel", context, () =>
      this.#cancelled(state, context),
    );
  }

  #played(
    operation: Operation,
    context: StepContext,
    play: () => MachineOutcome,
  ): Step {
    const identity = this.manifest.identity;

    return this.#telemetry.play(operation, identity, () => {
      const outcome = play();
      return this.#reportOf(outcome, context.now);
    });
  }

  #reportOf(outcome: MachineOutcome, now: number): Played {
    const step = stepOf(outcome, this.#seal);
    const measure = measureOf(outcome, now);

    return { step, measure };
  }

  #started(input: JsonValue, context: StartContext): MachineOutcome {
    const opened = this.#openedOf(input, context);
    const root = workflowRootOf(this.#program.root, opened.workflow, input);
    const machine = this.#machineOf(opened, root.frame, context);
    const prelude = workflowBegunOf(opened.workflow, machine);
    const begun: ReadyFiber = {
      kind: "run",
      fiber: rootFiber,
      control: root.control,
    };
    const agenda = [begun];

    return machine.runFibers(prelude, agenda);
  }

  #correlated(context: StartContext): MachineOutcome {
    const trigger = this.#triggerOf();
    const opened = this.#openedOf(null, context);
    const bottom = triggerK({ activation: opened.workflow });
    const scope = rootScopeOf(opened.workflow);
    const here: Here = { scope, value: null };
    const control = evaluating(trigger, here);
    const machine = this.#machineOf(opened, bottom, context);
    const correlating: ReadyFiber = { kind: "run", fiber: rootFiber, control };
    const agenda = [correlating];

    return machine.runFibers([], agenda);
  }

  #responded(
    state: State,
    response: EffectResponse,
    context: StepContext,
  ): MachineOutcome {
    const snapshot = this.#unendedOf(state);
    const setting = this.#settingOf(context);
    const machine = new Machine(snapshot, setting);

    if (snapshot.status === "suspended") {
      checkAdmitted(snapshot.fibers, response);
      checkUnqueued(snapshot.queued, response.id);
      const queuing = [queued(response)];
      return machine.runFibers(queuing, []);
    }

    const answer = admittedAnswerOf(snapshot.fibers, response);
    const agenda = [answer];
    return machine.runFibers([], agenda);
  }

  #suspended(state: State, context: StepContext): MachineOutcome {
    const snapshot = this.#unendedIn(state, "running");
    const setting = this.#settingOf(context);
    const machine = new Machine(snapshot, setting);
    const prelude = suspendedOf(snapshot.fibers, machine);

    return machine.runFibers(prelude, []);
  }

  #resumed(state: State, context: StepContext): MachineOutcome {
    const snapshot = this.#unendedIn(state, "suspended");
    const setting = this.#settingOf(context);
    const machine = new Machine(snapshot, setting);
    const prelude = resumedOf(snapshot.fibers, machine);
    const answers = snapshot.queued.map((response) =>
      answerOf(snapshot.fibers, response),
    );
    const agenda: readonly AgendaItem[] = [...answers, lapsing];

    return machine.runFibers(prelude, agenda);
  }

  #cancelled(state: State, context: StepContext): MachineOutcome {
    const snapshot = this.#unendedOf(state);
    const setting = this.#settingOf(context);
    const machine = new Machine(snapshot, setting);
    const cancel: ReadyFiber = {
      kind: "run",
      fiber: rootFiber,
      control: cancelling,
    };
    const agenda = [cancel];

    return machine.runFibers([], agenda);
  }

  #unendedOf(state: State): Snapshot {
    const snapshot = decodeState(state, this.#seal);
    const result = snapshot.result;
    const hasEnded = result.kind !== "running";

    if (hasEnded) {
      throw new InterpreterError(
        `The run has ended ${result.kind}: it takes no more calls.`,
      );
    }

    return snapshot;
  }

  #unendedIn(state: State, status: UnendedStatus): Snapshot {
    const snapshot = this.#unendedOf(state);

    if (snapshot.status !== status) {
      throw new InterpreterError(
        `The run is '${snapshot.status}': this call takes a '${status}' run.`,
      );
    }

    return snapshot;
  }

  #settingOf(context: StepContext): Setting {
    return {
      program: this.#program,
      services: this.#services,
      statics: this.#statics,
      context,
    };
  }

  #openedOf(input: JsonValue, context: StartContext): OpenedRun {
    const run = runRecordOf(context.instance, input, context.now);
    const empty = Store.initial(null);
    const workflow = empty.next;
    const cell = this.#workflowCellOf(workflow, context.now);
    const store = empty.allocated(cell);

    return { run, store, workflow };
  }

  #machineOf(opened: OpenedRun, bottom: Frame, context: StartContext): Machine {
    const continuation = Stack.of<Frame>(bottom);
    const fiber = fiberOf(rootFiber, "root", continuation);
    const fibers = [fiber];
    const nextFiber = rootFiber + 1;
    const snapshot = snapshotOf({
      run: opened.run,
      status: "running",
      store: opened.store,
      fibers,
      nextFiber,
      queued: [],
      result: unended,
    });
    const setting = this.#settingOf(context);

    return new Machine(snapshot, setting);
  }

  #triggerOf(): Stream {
    const [trigger] = this.#program.triggers;

    if (trigger === undefined) {
      throw new InterpreterError(
        "The program starts on no events: it has no trigger.",
      );
    }

    return trigger;
  }

  #workflowCellOf(address: Address, now: number): Activation {
    const descriptor = this.#statics.terms.workflowDescriptor;

    return activationOf({
      descriptor,
      enclosing: address,
      path: rootPath,
      startedAt: now,
    });
  }
}
