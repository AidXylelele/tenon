import type { FlowDirective } from '../flow-directive.js';
import type { JsonValue } from '../interfaces.js';
import { Outcome } from '../outcome.js';
import { TaskEnding } from './task-ending.js';

// A task whose `if` did not hold: it passes its raw input on and announces nothing.
export class SkippedEnding extends TaskEnding {
  readonly failure = null;
  readonly body = null;
  readonly #output: JsonValue;
  readonly #directive: FlowDirective;

  constructor(output: JsonValue, then: FlowDirective) {
    super();
    this.#output = output;
    this.#directive = then;
  }

  get output(): JsonValue {
    return this.#output;
  }

  get directive(): FlowDirective {
    return this.#directive;
  }

  override isSkipped(): boolean {
    return true;
  }

  phase(): null {
    return null;
  }

  outcome(): Outcome {
    return Outcome.of(this.#output);
  }
}
