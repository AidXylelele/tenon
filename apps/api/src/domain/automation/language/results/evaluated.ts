import { ErrorType } from '../error-type.js';
import type { JsonPointer } from '../json-pointer.js';
import { NulCharacter } from '../nul-character.js';
import type { WorkflowError } from '../workflow-error.js';
import { EvaluationResult } from './evaluation-result.js';

export class Evaluated extends EvaluationResult {
  static readonly #HOLDS_NUL =
    'The expression produced a NUL character, which a value cannot hold';

  failure(at: JsonPointer): WorkflowError | null {
    const unrecordable = NulCharacter.isIn(this.value);

    if (unrecordable)
      return ErrorType.Expression.errorAt(at, Evaluated.#HOLDS_NUL);

    return null;
  }
}
