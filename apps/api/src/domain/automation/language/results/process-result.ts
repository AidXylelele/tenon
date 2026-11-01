import type { JsonPointer } from '../json-pointer.js';
import type { ProcessReturn } from '../process-return.js';
import type { Outcome } from '../outcome.js';

export abstract class ProcessResult {
  readonly #id: string;

  constructor(id: string) {
    this.#id = id;
  }

  get id(): string {
    return this.#id;
  }

  abstract outcome(returns: ProcessReturn, at: JsonPointer): Outcome;
}
