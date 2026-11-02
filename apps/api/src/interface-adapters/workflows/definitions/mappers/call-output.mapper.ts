import { CallOutput } from '../../../../domain/automation/language/call-output.js';
import type { JsonPointer } from '../../../../domain/automation/language/json-pointer.js';
import { OutputFormat } from '../../../../domain/automation/language/output-format.js';
import {
  InvalidDocumentValueError,
  UnknownValueError,
} from '../../../../domain/errors.js';

export class CallOutputMapper {
  static toDomain(
    output: string | undefined,
    redirect: boolean | undefined,
    at: JsonPointer,
  ): CallOutput {
    const following = redirect ?? false;

    if (output === undefined)
      return new CallOutput(OutputFormat.Content, following);

    const format = OutputFormat.named(output);

    if (format === null) {
      const outputAt = at.at('output');
      const unknown = new UnknownValueError(output);
      throw new InvalidDocumentValueError(outputAt, unknown);
    }

    return new CallOutput(format, following);
  }
}
