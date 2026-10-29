import type { Expression } from './expression.js';
import { Problem } from './problem.js';
import type { WorkflowReference } from './workflow-reference.js';

export class Findings {
  readonly #problems: Problem[] = [];
  readonly #expressions: Expression[] = [];
  readonly #references: WorkflowReference[] = [];

  get problems(): readonly Problem[] {
    return this.#problems;
  }

  get expressions(): readonly Expression[] {
    return this.#expressions;
  }

  get references(): readonly WorkflowReference[] {
    return this.#references;
  }

  isClean(): boolean {
    return this.#problems.length === 0;
  }

  refuse(pointer: string, reason: string): void {
    const problem = new Problem(pointer, reason);
    this.#problems.push(problem);
  }

  register(expression: Expression): void {
    this.#expressions.push(expression);
  }

  reference(reference: WorkflowReference): void {
    this.#references.push(reference);
  }
}
