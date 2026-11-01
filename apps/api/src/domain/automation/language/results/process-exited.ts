import type { ProcessExitedProps } from '../interfaces.js';
import type { ProcessReturn } from '../process-return.js';
import { Outcome } from '../outcome.js';
import { ProcessResult } from './process-result.js';

export class ProcessExited extends ProcessResult {
  readonly #code: number;
  readonly #stdout: string;
  readonly #stderr: string;

  constructor(props: ProcessExitedProps) {
    super(props.id);
    this.#code = props.code;
    this.#stdout = props.stdout;
    this.#stderr = props.stderr;
  }

  get code(): number {
    return this.#code;
  }

  get stdout(): string {
    return this.#stdout;
  }

  get stderr(): string {
    return this.#stderr;
  }

  outcome(returns: ProcessReturn): Outcome {
    const output = returns.outputOf(this);
    return Outcome.of(output);
  }
}
