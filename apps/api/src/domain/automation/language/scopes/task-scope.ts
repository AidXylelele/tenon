import type { Definition } from '../definition.js';
import type { JsonObject, JsonValue, TaskScopeProps } from '../interfaces.js';
import type { Task } from '../tasks/task.js';

export class TaskScope<T extends Task = Task> {
  static readonly #MILLISECONDS_PER_SECOND = 1000;

  readonly #id: string;
  readonly #task: T;
  readonly #definition: Definition;
  readonly #rawInput: JsonValue;
  readonly #context: JsonValue;
  readonly #workflow: JsonObject;
  readonly #runtime: JsonObject;
  readonly #variables: JsonObject;
  readonly #startedAt: Date;
  readonly #now: Date;

  constructor(props: TaskScopeProps<T>) {
    this.#id = props.id;
    this.#task = props.task;
    this.#definition = props.definition;
    this.#rawInput = props.rawInput;
    this.#context = props.context;
    this.#workflow = props.workflow;
    this.#runtime = props.runtime;
    this.#variables = props.variables;
    this.#startedAt = props.startedAt;
    this.#now = props.now;
  }

  get id(): string {
    return this.#id;
  }

  get task(): T {
    return this.#task;
  }

  get definition(): Definition {
    return this.#definition;
  }

  get rawInput(): JsonValue {
    return this.#rawInput;
  }

  get context(): JsonValue {
    return this.#context;
  }

  get workflow(): JsonObject {
    return this.#workflow;
  }

  get runtime(): JsonObject {
    return this.#runtime;
  }

  get variables(): JsonObject {
    return this.#variables;
  }

  get startedAt(): Date {
    return this.#startedAt;
  }

  get now(): Date {
    return this.#now;
  }

  get prefix(): string {
    return `${this.#id}:`;
  }

  prefixFor(part: string): string {
    return `${this.#id}:${part}:`;
  }

  workId(part: string): string {
    return `${this.#id}:${part}`;
  }

  variablesWith(additions: JsonObject): JsonObject {
    const variables = this.#copyOf(this.#variables);

    for (const name of Object.keys(additions))
      variables[name] = additions[name];

    return variables;
  }

  entryArguments(): JsonObject {
    return this.#common(null);
  }

  definitionArguments(input: JsonValue): JsonObject {
    const args = this.#common(null);
    args.input = input;
    args.authorization = null;
    return args;
  }

  definitionArgumentsWith(input: JsonValue, additions: JsonObject): JsonObject {
    const args = this.definitionArguments(input);
    const merged = this.#copyOf(args);

    for (const name of Object.keys(additions)) merged[name] = additions[name];

    return merged;
  }

  outputArguments(
    input: JsonValue,
    rawOutput: JsonValue,
    authorization: JsonObject | null,
  ): JsonObject {
    const args = this.#common(rawOutput);
    args.input = input;
    args.authorization = authorization;
    return args;
  }

  exportArguments(
    input: JsonValue,
    rawOutput: JsonValue,
    output: JsonValue,
    authorization: JsonObject | null,
  ): JsonObject {
    const args = this.outputArguments(input, rawOutput, authorization);
    const exported = this.#copyOf(args);
    exported.output = output;
    return exported;
  }

  #common(rawOutput: JsonValue): Record<string, JsonValue | undefined> {
    const args = this.#copyOf(this.#variables);
    const descriptor = this.#descriptor(rawOutput);
    args.context = this.#context;
    args.task = descriptor;
    args.workflow = this.#workflow;
    args.runtime = this.#runtime;
    return args;
  }

  #descriptor(rawOutput: JsonValue): JsonObject {
    const reference = this.#task.reference;
    const definition = this.#definition.jsonAt(reference);
    const pointer = reference.toString();
    const startedAt = this.#instant(this.#startedAt);
    return {
      name: this.#task.name,
      reference: pointer,
      definition,
      input: this.#rawInput,
      output: rawOutput,
      startedAt,
    };
  }

  #instant(date: Date): JsonObject {
    const milliseconds = date.getTime();
    const fraction = milliseconds / TaskScope.#MILLISECONDS_PER_SECOND;
    const seconds = Math.floor(fraction);
    const iso8601 = date.toISOString();
    return { iso8601, epoch: { seconds, milliseconds } };
  }

  #copyOf(object: JsonObject): Record<string, JsonValue | undefined> {
    const copy: Record<string, JsonValue | undefined> = {};

    for (const name of Object.keys(object)) copy[name] = object[name];

    return copy;
  }
}
