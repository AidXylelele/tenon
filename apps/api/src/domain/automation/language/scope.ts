import type { Expression } from './expression.js';
import type { Findings } from './findings.js';
import type { ScopeProps } from './interfaces.js';
import { ReusableComponents } from './reusable-components.js';
import { WorkflowReference } from './workflow-reference.js';
import type { WorkflowTarget } from './workflow-target.js';

export class Scope {
  readonly #pointer: string;
  readonly #findings: Findings;
  readonly #components: ReusableComponents;
  readonly #tasks: ReadonlySet<string>;
  readonly #variables: ReadonlySet<string>;

  constructor(props: ScopeProps) {
    this.#pointer = props.pointer;
    this.#findings = props.findings;
    this.#components = props.components;
    this.#tasks = props.tasks;
    this.#variables = props.variables;
  }

  static root(findings: Findings): Scope {
    const components = ReusableComponents.none();
    const tasks = new Set<string>();
    const variables = new Set<string>();
    return new Scope({ pointer: '', findings, components, tasks, variables });
  }

  get pointer(): string {
    return this.#pointer;
  }

  get components(): ReusableComponents {
    return this.#components;
  }

  at(segment: string | number): Scope {
    const text = String(segment);
    const escaped = text.replaceAll('~', '~0').replaceAll('/', '~1');
    const pointer = `${this.#pointer}/${escaped}`;
    return new Scope({
      pointer,
      findings: this.#findings,
      components: this.#components,
      tasks: this.#tasks,
      variables: this.#variables,
    });
  }

  using(components: ReusableComponents): Scope {
    return new Scope({
      pointer: this.#pointer,
      findings: this.#findings,
      components,
      tasks: this.#tasks,
      variables: this.#variables,
    });
  }

  within(tasks: ReadonlySet<string>): Scope {
    return new Scope({
      pointer: this.#pointer,
      findings: this.#findings,
      components: this.#components,
      tasks,
      variables: this.#variables,
    });
  }

  get variables(): readonly string[] {
    return Array.from(this.#variables);
  }

  declaring(names: readonly string[]): Scope {
    const variables = new Set(this.#variables);

    for (const name of names) variables.add(name);

    return new Scope({
      pointer: this.#pointer,
      findings: this.#findings,
      components: this.#components,
      tasks: this.#tasks,
      variables,
    });
  }

  knowsTask(name: string): boolean {
    return this.#tasks.has(name);
  }

  refuse(reason: string): void {
    this.#findings.refuse(this.#pointer, reason);
  }

  register(expression: Expression): void {
    this.#findings.register(expression);
  }

  reference(target: WorkflowTarget): void {
    const reference = new WorkflowReference(this.#pointer, target);
    this.#findings.reference(reference);
  }
}
