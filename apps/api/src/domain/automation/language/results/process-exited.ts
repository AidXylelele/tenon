import type { ProcessExitedProps } from '../interfaces.js';
import type { ProcessReturn } from '../process-return.js';
import { ErrorType } from '../error-type.js';
import type { JsonPointer } from '../json-pointer.js';
import { NulCharacter } from '../nul-character.js';
import { Outcome } from '../outcome.js';
import { ProcessResult } from './process-result.js';

export class ProcessExited extends ProcessResult {
  static readonly #HOLDS_NUL =
    'The process wrote a NUL character, which a value cannot hold';

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

  outcome(returns: ProcessReturn, at: JsonPointer): Outcome {
    const output = returns.outputOf(this);
    const unrecordable = NulCharacter.isIn(output);

    if (!unrecordable) return Outcome.of(output);

    const error = ErrorType.Runtime.errorAt(at, ProcessExited.#HOLDS_NUL);
    return Outcome.failed(error);
  }
}
