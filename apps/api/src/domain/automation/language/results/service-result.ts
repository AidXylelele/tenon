import type { CallOutput } from '../call-output.js';
import type { JsonPointer } from '../json-pointer.js';
import type { Outcome } from '../outcome.js';

export abstract class ServiceResult {
  readonly #id: string;

  constructor(id: string) {
    this.#id = id;
  }

  get id(): string {
    return this.#id;
  }

  abstract outcome(output: CallOutput, at: JsonPointer): Outcome;
}
