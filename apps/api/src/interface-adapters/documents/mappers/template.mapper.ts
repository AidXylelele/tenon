import type { JsonValue } from '../../../domain/automation/language/interfaces.js';
import type { JsonPointer } from '../../../domain/automation/language/json-pointer.js';
import { Template } from '../../../domain/automation/language/template.js';

export class TemplateMapper {
  static toDomain(value: JsonValue, at: JsonPointer): Template;
  static toDomain(
    value: JsonValue | undefined,
    at: JsonPointer,
  ): Template | null;
  static toDomain(
    value: JsonValue | undefined,
    at: JsonPointer,
  ): Template | null {
    if (value === undefined) return null;

    return new Template({ pointer: at, value });
  }
}
