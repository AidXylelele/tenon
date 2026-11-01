import type { JsonPointer } from '../../../domain/automation/language/json-pointer.js';
import { ProcessReturn } from '../../../domain/automation/language/process-return.js';
import {
  InvalidDocumentValueError,
  UnknownValueError,
} from '../../../domain/errors.js';

export class ProcessReturnMapper {
  static toDomain(
    node: string | undefined,
    at: JsonPointer,
  ): ProcessReturn | null {
    if (node === undefined) return null;

    const returns = ProcessReturn.named(node);

    if (returns !== null) return returns;

    const returnAt = at.at('return');
    const unknown = new UnknownValueError(node);
    throw new InvalidDocumentValueError(returnAt, unknown);
  }
}
