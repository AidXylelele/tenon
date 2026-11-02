import { ReservedVariableError } from '../../errors.js';
import { RuntimeArgument } from './enums.js';
import type { JsonPointer } from './json-pointer.js';

// The name under which a task's expressions read a loop's item and index or a caught error:
// never one of the standard's runtime arguments, which the name would hide.
export class VariableName {
  readonly #name: string;

  constructor(name: string, at: JsonPointer) {
    const reserved: readonly string[] = Object.values(RuntimeArgument);

    if (reserved.includes(name)) throw new ReservedVariableError(name, at);

    this.#name = name;
  }

  get name(): string {
    return this.#name;
  }
}
