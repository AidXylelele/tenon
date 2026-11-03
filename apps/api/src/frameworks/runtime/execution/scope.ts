import type { Specification } from '@openworkflowspec/sdk';
import type { JsonObject, JsonValue } from '../../../domain/automation/json.js';
import type {
  RunObserver,
  RunPlan,
} from '../../../interface-adapters/workflows/interfaces.js';
import { JsonPointer } from '../document/json-pointer.js';
import type { Durability, RuntimeDescriptor } from '../interfaces.js';
import { SecretValues } from './secret-values.js';
import { DateTimes } from './date-times.js';
import type { Race } from './race.js';
import type { TaskMoment } from './task-moment.js';

// Where the workflow's context (`$context`) is kept: the run's, or a fork branch's own until
// its fork ends.
export interface ContextHolder {
  context: JsonObject;
}

// What every task of one run shares: the plan, the engine, the observer, the workflow's
// context (replaced by each export) and whether the platform stopped the run.
export class RunContext implements ContextHolder {
  context: JsonObject = {};
  #stopped = false;
  #secrets: JsonObject = {};
  #masked: readonly string[] = [];

  constructor(
    readonly plan: RunPlan,
    readonly durability: Durability,
    readonly observer: RunObserver,
    readonly runtime: RuntimeDescriptor,
  ) {}

  get workflow(): Specification.Workflow {
    return this.plan.document as unknown as Specification.Workflow;
  }

  get stopped(): boolean {
    return this.#stopped;
  }

  // The platform ended the instance: no task of the run starts any more.
  stop(): void {
    this.#stopped = true;
  }

  // `$secrets` (DSL 1.0.3): each value as JSON when it is a JSON object, as text otherwise.
  get secrets(): JsonObject {
    return this.#secrets;
  }

  // The values this execution read; nothing the platform records, shows or delivers keeps
  // them (FR-007).
  keepSecrets(values: Record<string, string>): void {
    const secrets: Record<string, JsonValue> = {};

    for (const [name, value] of Object.entries(values))
      secrets[name] = SecretValues.parsed(value);

    this.#secrets = secrets;
    this.#masked = SecretValues.textsOf(secrets);
  }

  masked<T extends JsonValue>(value: T): T {
    return SecretValues.masked(value, this.#masked);
  }

  get workflowArgument(): JsonObject {
    const started = Date.parse(this.plan.startedAt);
    const startedAt = DateTimes.descriptorOf(started);
    return {
      id: this.plan.instanceId,
      definition: this.plan.document,
      input: this.plan.input,
      startedAt,
    };
  }

  get runtimeArgument(): JsonObject {
    return {
      name: this.runtime.name,
      version: this.runtime.version,
      metadata: {},
    };
  }

  // The arguments of the workflow's own `input.from`, `timeout` and `output.as`; `$secrets`
  // is bound for `input.from`, the only place publish lets an expression name it.
  argumentsFor(input: JsonValue): JsonObject {
    return {
      context: this.context,
      input,
      secrets: this.#secrets,
      workflow: this.workflowArgument,
      runtime: this.runtimeArgument,
    };
  }
}

interface Place {
  readonly pointer: JsonPointer;
  readonly path: string;
  readonly variables: JsonObject;
  readonly holder: ContextHolder;
  readonly deadline: number | null;
  readonly startedAt: number | null;
  readonly races: readonly Race[];
}

// Where a task runs: its pointer in the document (its `reference`), the name of its steps in
// the journal (the pointer, with an iteration, an attempt or a visit when it runs again), the
// variables its enclosing tasks bound (`$item`, `$index`, a caught error), the context it reads,
// the deadline its own and enclosing timeouts set, and the races it may lose.
export class Scope {
  readonly #run: RunContext;
  readonly #place: Place;

  private constructor(run: RunContext, place: Place) {
    this.#run = run;
    this.#place = place;
  }

  static root(run: RunContext, deadline: number | null): Scope {
    return new Scope(run, {
      pointer: JsonPointer.ROOT,
      path: '',
      variables: {},
      holder: run,
      deadline,
      startedAt: null,
      races: [],
    });
  }

  get run(): RunContext {
    return this.#run;
  }

  get pointer(): JsonPointer {
    return this.#place.pointer;
  }

  get context(): JsonObject {
    return this.#place.holder.context;
  }

  // The time by which the task must end, in engine milliseconds; null: none.
  get deadline(): number | null {
    return this.#place.deadline;
  }

  // When this scope's composite task started; its kind runs only after that.
  get startedAt(): number {
    const startedAt = this.#place.startedAt;

    if (startedAt === null)
      throw new TypeError('A task begins before its kind runs');

    return startedAt;
  }

  // The run was stopped, or a race this task runs in was decided: it must not start.
  get halted(): boolean {
    if (this.#run.stopped) return true;

    return this.#place.races.some((race) => race.decided);
  }

  // The journal name of this scope's step, and of its other steps with a suffix.
  get stepName(): string {
    const path = this.#place.path;
    return path === '' ? '/' : path;
  }

  named(suffix: string): string {
    return `${this.stepName}@${suffix}`;
  }

  replaceContext(context: JsonObject): void {
    this.#place.holder.context = context;
  }

  child(token: string | number): Scope {
    const pointer = this.#place.pointer.child(token);
    const escaped = Scope.#escaped(token);
    const path = `${this.#place.path}/${escaped}`;
    return this.#moved({ pointer, path, startedAt: null });
  }

  // The same place reached again: a loop's iteration, a retry's attempt or a later visit.
  again(marker: string): Scope {
    const path = `${this.#place.path}${marker}`;
    return this.#moved({ path });
  }

  // Somewhere else in the document (a declared function's body), journaled under this scope
  // apart from this scope's own steps (`@<suffix>`).
  elsewhere(pointer: JsonPointer, marker: string): Scope {
    const escaped = Scope.#escaped(marker);
    const path = `${this.#place.path}:${escaped}`;
    return this.#moved({ pointer, path, startedAt: null });
  }

  binding(variables: JsonObject): Scope {
    const bound: Record<string, JsonValue> = {};
    Object.assign(bound, this.#place.variables, variables);
    return this.#moved({ variables: bound });
  }

  // The composite task of this scope started then and must end by the deadline.
  begun(startedAt: number, deadline: number | null): Scope {
    return this.#moved({ startedAt, deadline });
  }

  // A fork branch: it keeps its own context until the fork ends.
  holding(holder: ContextHolder): Scope {
    return this.#moved({ holder });
  }

  // A competing branch: it stops at its next task once the race is decided.
  racing(race: Race): Scope {
    const races = this.#place.races.concat([race]);
    return this.#moved({ races });
  }

  // The arguments of a task's expressions (DSL 1.0.3, "Runtime Expression Arguments").
  argumentsFor(moment: TaskMoment): JsonObject {
    const args: Record<string, JsonValue> = {};
    Object.assign(args, this.#place.variables);
    args.context = this.context;
    args.input = moment.input;
    args.workflow = this.#run.workflowArgument;
    args.runtime = this.#run.runtimeArgument;
    args.task = moment.descriptorAt(this.#place.pointer);
    const authorization = moment.authorization;
    const output = moment.output;

    if (authorization !== null) args.authorization = authorization;

    if (output !== undefined) args.output = output;

    return args;
  }

  #moved(changes: Partial<Place>): Scope {
    const place: Place = Object.assign({}, this.#place, changes);
    return new Scope(this.#run, place);
  }

  static #escaped(token: string | number): string {
    return String(token).replaceAll('~', '~0').replaceAll('/', '~1');
  }
}
