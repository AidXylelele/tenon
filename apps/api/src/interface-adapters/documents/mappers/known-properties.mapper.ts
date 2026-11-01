import { UnsupportedConstructError } from '../../../domain/errors.js';
import { UnsupportedConstruct } from '../../../domain/automation/language/enums.js';
import type { JsonPointer } from '../../../domain/automation/language/json-pointer.js';

export class KnownPropertiesMapper {
  static confirm(
    node: object,
    known: readonly string[],
    at: JsonPointer,
  ): void {
    for (const name of Object.keys(node)) {
      if (known.includes(name)) continue;

      const nameAt = at.at(name);
      throw new UnsupportedConstructError(
        UnsupportedConstruct.UnknownProperty,
        nameAt,
      );
    }
  }
}
