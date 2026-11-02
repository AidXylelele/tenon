import type { Definition } from '../definition.js';
import type { DueTime } from '../due-time.js';
import type { Expression } from '../expression.js';
import type { Evaluation, JsonObject, JsonValue } from '../interfaces.js';
import type { RoundResults } from '../round-results.js';
import { RoundWork } from '../round-work.js';
import type { Task } from '../tasks/task.js';
import type { Template } from '../template.js';
import type { WorkflowError } from '../workflow-error.js';
import type { TaskScope } from './task-scope.js';

// A task's scope while its body runs: around the transformed input, it evaluates, checks and
// fills the body's templates, and offers nothing of the stages that follow.
export class BodyScope<T extends Task = Task> {
  readonly #scope: TaskScope<T>;
  readonly #input: JsonValue;
  readonly #deadline: DueTime;

  constructor(scope: TaskScope<T>, input: JsonValue, deadline: DueTime) {
    this.#scope = scope;
    this.#input = input;
    this.#deadline = deadline;
  }

  get id(): string {
    return this.#scope.id;
  }

  get task(): T {
    return this.#scope.task;
  }

  get input(): JsonValue {
    return this.#input;
  }

  get variables(): JsonObject {
    return this.#scope.variables;
  }

  get definition(): Definition {
    return this.#scope.definition;
  }

  // The earliest deadline of the task and the tasks around it.
  get deadline(): DueTime {
    return this.#deadline;
  }

  get now(): Date {
    return this.#scope.now;
  }

  get prefix(): string {
    return this.#scope.prefix;
  }

  prefixFor(part: string): string {
    return this.#scope.prefixFor(part);
  }

  workId(part: string): string {
    return this.#scope.workId(part);
  }

  variablesWith(additions: JsonObject): JsonObject {
    return this.#scope.variablesWith(additions);
  }

  evaluating(templates: readonly (Expression | Template)[]): RoundWork {
    const prefix = this.#scope.prefix;
    const args = this.definitionArguments();
    const evaluations: Evaluation[] = [];

    for (const template of templates) {
      const found = template.evaluationsFor(prefix, this.#input, args);

      for (const evaluation of found) evaluations.push(evaluation);
    }

    return RoundWork.evaluating(evaluations);
  }

  failureIn(
    templates: readonly (Expression | Template)[],
    results: RoundResults,
  ): WorkflowError | null {
    const prefix = this.#scope.prefix;
    const at = this.#scope.task.reference;

    for (const template of templates) {
      const failure = template.failureIn(prefix, results, at);

      if (failure !== null) return failure;
    }

    return null;
  }

  filled(template: Expression | Template, results: RoundResults): JsonValue {
    const prefix = this.#scope.prefix;
    return template.fill(prefix, results);
  }

  // The scope's own entry arguments, so the root's rules (WorkflowScope) hold in its body too.
  definitionArguments(): JsonObject {
    const args = this.#scope.entryArguments();
    const definition: Record<string, JsonValue | undefined> = {};

    for (const name of Object.keys(args)) definition[name] = args[name];

    definition.input = this.#input;
    definition.authorization = null;
    return definition;
  }

  definitionArgumentsWith(additions: JsonObject): JsonObject {
    const args = this.definitionArguments();
    const merged: Record<string, JsonValue | undefined> = {};

    for (const name of Object.keys(args)) merged[name] = args[name];

    for (const name of Object.keys(additions)) merged[name] = additions[name];

    return merged;
  }
}
