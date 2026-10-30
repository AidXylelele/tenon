import type { Expression } from './expression.js';
import type { ExpressionDuration } from './expression-duration.js';
import type { FixedDuration } from './fixed-duration.js';
import type { Input } from './input.js';
import type { DefinitionProps } from './interfaces.js';
import type { Output } from './output.js';
import type { ReusableComponents } from './reusable-components.js';
import type { TaskList } from './task-list.js';
import type { WorkflowName } from './workflow-name.js';

export class Definition {
  readonly #workflow: WorkflowName;
  readonly #version: string;
  readonly #dslVersion: string;
  readonly #input: Input;
  readonly #output: Output;
  readonly #timeout: FixedDuration | ExpressionDuration | null;
  readonly #body: TaskList;
  readonly #components: ReusableComponents;

  constructor(props: DefinitionProps) {
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
  }

  get workflow(): WorkflowName {
    return this.#workflow;
  }

  get version(): string {
    return this.#version;
  }

  get dslVersion(): string {
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

  get expressions(): readonly Expression[] {
    const input = this.#input.expressions;
    const output = this.#output.expressions;
    const timeout = this.#timeout?.expressions ?? [];
    const body = this.#body.expressions;
    const components = this.#components.expressions;
    return input.concat(output, timeout, body, components);
  }
}
