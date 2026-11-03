import type { Specification } from '@openworkflowspec/sdk';
import type { JsonObject, JsonValue } from '../../../domain/automation/json.js';
import type {
  RunObserver,
  RunPlan,
} from '../../../interface-adapters/workflows/interfaces.js';
import { JsonPointer } from '../document/json-pointer.js';
import type { Durability, RuntimeDescriptor } from '../interfaces.js';

// What every task of one run shares: the plan, the engine, the observer, the workflow's
// context (`$context`, replaced by each export) and its deadline.
export class RunContext {
  context: JsonObject = {};

  constructor(
    readonly plan: RunPlan,
    readonly durability: Durability,
    readonly observer: RunObserver,
    readonly runtime: RuntimeDescriptor,
    readonly deadline: number | null,
  ) {}

  get workflow(): Specification.Workflow {
    return this.plan.document as unknown as Specification.Workflow;
  }

  get workflowArgument(): JsonObject {
    return {
      id: this.plan.instanceId,
      definition: this.plan.document,
      input: this.plan.input,
      startedAt: this.plan.startedAt,
    };
  }

  get runtimeArgument(): JsonObject {
    return {
      name: this.runtime.name,
      version: this.runtime.version,
      metadata: {},
    };
  }

  // The arguments of the workflow's own `input.from` and `output.as`.
  argumentsFor(input: JsonValue): JsonObject {
    return {
      context: this.context,
      input,
      workflow: this.workflowArgument,
      runtime: this.runtimeArgument,
    };
  }
}

// Where a task runs: its pointer in the document (its `reference`), the name of its steps in
// the journal (the pointer, with an iteration, an attempt or a visit when it runs again), and the
// variables its enclosing tasks bound (`$item`, `$index`, a caught error).
export class Scope {
  readonly #run: RunContext;
  readonly #pointer: JsonPointer;
  readonly #path: string;
  readonly #variables: JsonObject;

  private constructor(
    run: RunContext,
    pointer: JsonPointer,
    path: string,
    variables: JsonObject,
  ) {
    this.#run = run;
    this.#pointer = pointer;
    this.#path = path;
    this.#variables = variables;
  }

  static root(run: RunContext): Scope {
    return new Scope(run, JsonPointer.ROOT, '', {});
  }

  get run(): RunContext {
    return this.#run;
  }

  get pointer(): JsonPointer {
    return this.#pointer;
  }

  // The journal name of this scope's step, and of its other steps with a suffix.
  get stepName(): string {
    return this.#path === '' ? '/' : this.#path;
  }

  named(suffix: string): string {
    return `${this.stepName}@${suffix}`;
  }

  child(token: string | number): Scope {
    const pointer = this.#pointer.child(token);
    const escaped = String(token).replaceAll('~', '~0').replaceAll('/', '~1');
    const path = `${this.#path}/${escaped}`;
    return new Scope(this.#run, pointer, path, this.#variables);
  }

  // The same place reached again: a loop's iteration, a retry's attempt or a later visit.
  again(marker: string): Scope {
    const path = `${this.#path}${marker}`;
    return new Scope(this.#run, this.#pointer, path, this.#variables);
  }

  // Somewhere else in the document (a declared function's body), journaled under this scope.
  elsewhere(pointer: JsonPointer, marker: string): Scope {
    const path = `${this.#path}@${marker}`;
    return new Scope(this.#run, pointer, path, this.#variables);
  }

  binding(variables: JsonObject): Scope {
    const bound: Record<string, JsonValue> = {};
    Object.assign(bound, this.#variables, variables);
    return new Scope(this.#run, this.#pointer, this.#path, bound);
  }

  // The arguments of the expressions of a task (DSL 1.0.3, "Runtime Expression Arguments").
  argumentsFor(
    name: string,
    task: Specification.Task,
    input: JsonValue,
    output: JsonValue | null,
  ): JsonObject {
    const args: Record<string, JsonValue> = {};
    Object.assign(args, this.#variables);
    args.context = this.#run.context;
    args.input = input;
    args.workflow = this.#run.workflowArgument;
    args.runtime = this.#run.runtimeArgument;
    args.task = {
      name,
      reference: this.#pointer.toString(),
      definition: task as unknown as JsonObject,
      input,
    };

    if (output !== null) args.output = output;

    return args;
  }
}
