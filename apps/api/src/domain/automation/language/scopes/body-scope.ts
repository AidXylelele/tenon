import type { JsonObject, JsonValue } from '../interfaces.js';
import type { Task } from '../tasks/task.js';
import { TaskScope } from './task-scope.js';

export class BodyScope<T extends Task = Task> extends TaskScope<T> {
  readonly #input: JsonValue;

  constructor(scope: TaskScope<T>, input: JsonValue) {
    super({
      id: scope.id,
      task: scope.task,
      definition: scope.definition,
      rawInput: scope.rawInput,
      context: scope.context,
      instanceId: scope.instanceId,
      workflowInput: scope.workflowInput,
      workflowStartedAt: scope.workflowStartedAt,
      runtime: scope.runtime,
      variables: scope.variables,
      startedAt: scope.startedAt,
      now: scope.now,
    });
    this.#input = input;
  }

  get input(): JsonValue {
    return this.#input;
  }

  definitionArguments(): JsonObject {
    const args = this.entryArguments();
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
