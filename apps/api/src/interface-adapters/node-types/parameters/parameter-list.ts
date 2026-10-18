import type { ParameterValue } from './parameter-value.js';
import type { ResolutionContext } from './resolution-context.js';

export class ParameterList implements ParameterValue {
  readonly #path: string;
  readonly #elements: readonly ParameterValue[];

  constructor(path: string, elements: readonly ParameterValue[]) {
    this.#path = path;
    this.#elements = elements;
  }

  get path(): string {
    return this.#path;
  }

  get isDynamic(): boolean {
    return false;
  }

  resolve(context: ResolutionContext): unknown[] {
    return this.#elements.map((element) => element.resolve(context));
  }

  sketch(): unknown[] {
    return this.#elements.map((element) => element.sketch());
  }

  leaves(): ParameterValue[] {
    const leaves: ParameterValue[] = [];

    for (const element of this.#elements) {
      const elementLeaves = element.leaves();
      leaves.push(...elementLeaves);
    }

    return leaves;
  }

  renameNodes(names: ReadonlyMap<string, string>): unknown[] {
    return this.#elements.map((element) => element.renameNodes(names));
  }
}
