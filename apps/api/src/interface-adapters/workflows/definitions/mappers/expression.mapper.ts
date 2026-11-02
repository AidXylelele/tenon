import { Expression } from '../../../../domain/automation/language/expression.js';
import type { JsonPointer } from '../../../../domain/automation/language/json-pointer.js';

export class ExpressionMapper {
  static toDomain(text: string, at: JsonPointer): Expression;
  static toDomain(text: string | undefined, at: JsonPointer): Expression | null;
  static toDomain(
    text: string | undefined,
    at: JsonPointer,
  ): Expression | null {
    if (text === undefined) return null;

    return Expression.of({ text, pointer: at });
  }
}
