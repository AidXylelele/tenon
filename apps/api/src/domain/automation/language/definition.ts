import { UnknownTaskError } from '../../errors.js';
import type { DslVersion } from './enums.js';
import { Export } from './export.js';
import { FlowDirective } from './flow-directive.js';
import type { Expression } from './expression.js';
import type { ExpressionDuration } from './expression-duration.js';
import type { FixedDuration } from './fixed-duration.js';
import type { Input } from './input.js';
import type { DefinitionProps, JsonObject, JsonValue } from './interfaces.js';
import { JsonPointer } from './json-pointer.js';
import type { Output } from './output.js';
import type { ReusableComponents } from './reusable-components.js';
import type { Task } from './tasks/task.js';
import { TaskBase } from './task-base.js';
import type { TaskList } from './task-list.js';
import { DoTask } from './tasks/do-task.js';
import type { WorkflowName } from './workflow-name.js';

export class Definition {
  readonly #document: JsonObject;
  readonly #workflow: WorkflowName;
  readonly #version: string;
  readonly #dslVersion: DslVersion;
  readonly #input: Input;
  readonly #output: Output;
  readonly #timeout: FixedDuration | ExpressionDuration | null;
  readonly #body: TaskList;
  readonly #components: ReusableComponents;
  readonly #root: DoTask;
  readonly #tasks: ReadonlyMap<string, Task>;

  constructor(props: DefinitionProps) {
    this.#document = props.document;
    this.#workflow = props.workflow;
    this.#version = props.version;
    this.#dslVersion = props.dslVersion;
    this.#input = props.input;
    this.#output = props.output;
    this.#timeout = props.timeout;
    this.#body = props.body;
    this.#components = props.components;
    this.#body.confirmCalls(this.#components);
    this.#components.confirmCalls();
    this.#root = this.#rootTask();
    this.#tasks = this.#indexOf(this.#root);
  }

  get workflow(): WorkflowName {
    return this.#workflow;
  }

  get version(): string {
    return this.#version;
  }

  get dslVersion(): DslVersion {
    return this.#dslVersion;
  }

  get input(): Input {
    return this.#input;
  }

  get output(): Output {
    return this.#output;
  }

  get timeout(): FixedDuration | ExpressionDuration | null {
    return this.#timeout;
  }

  get body(): TaskList {
    return this.#body;
  }

  get components(): ReusableComponents {
    return this.#components;
  }

  get root(): DoTask {
    return this.#root;
  }

  get expressions(): readonly Expression[] {
    const input = this.#input.expressions;
    const output = this.#output.expressions;
    const timeout = this.#timeout?.expressions ?? [];
    const body = this.#body.expressions;
    const components = this.#components.expressions;
    return input.concat(output, timeout, body, components);
  }

  taskAt(reference: JsonPointer): Task {
    const pointer = reference.toString();
    const task = this.#tasks.get(pointer);

    if (task === undefined) throw new UnknownTaskError(pointer, reference);

    return task;
  }

  jsonAt(pointer: JsonPointer): JsonValue {
    let value: JsonValue | undefined = this.#document;

    for (const token of pointer.tokens) value = this.#childOf(value, token);

    return value ?? null;
  }

  #childOf(value: JsonValue | undefined, token: string): JsonValue | undefined {
    if (typeof value !== 'object' || value === null) return undefined;

    if (!Array.isArray(value)) return value[token];

    const index = Number(token);
    return value[index];
  }

  #rootTask(): DoTask {
    const reference = JsonPointer.root();
    const exported = Export.none();
    const then = FlowDirective.End;
    const base = new TaskBase({
      condition: null,
      input: this.#input,
      output: this.#output,
      export: exported,
      timeout: this.#timeout,
      then,
    });
    return new DoTask({
      name: this.#workflow.name,
      reference,
      base,
      body: this.#body,
    });
  }

  #indexOf(root: DoTask): ReadonlyMap<string, Task> {
    const tasks = new Map<string, Task>();
    const pending: Task[] = [root];

    for (const declared of this.#components.declaredFunctions)
      pending.push(declared);

    for (let task = pending.pop(); task !== undefined; task = pending.pop()) {
      const pointer = task.reference.toString();
      tasks.set(pointer, task);

      for (const list of task.children)
        for (const child of list.tasks) pending.push(child);
    }

    return tasks;
  }
}
