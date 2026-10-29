import { DefinitionRejectedError } from '../../errors.js';
import type { Definition } from './definition.js';
import type { ReportProps } from './interfaces.js';
import type { Problem } from './problem.js';

export class Report {
  readonly #definition: Definition | null;
  readonly #problems: readonly Problem[];

  constructor(props: ReportProps) {
    this.#definition = props.definition;
    this.#problems = props.problems;
  }

  get problems(): readonly Problem[] {
    return this.#problems;
  }

  isClean(): boolean {
    return this.#definition !== null;
  }

  publishable(): Definition {
    if (this.#definition === null)
      throw new DefinitionRejectedError(this.#problems);

    return this.#definition;
  }
}
