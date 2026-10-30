import type { Expression } from '../../../domain/automation/language/expression.js';
import type { JsonObject } from '../../../domain/automation/language/interfaces.js';
import type { JsonPointer } from '../../../domain/automation/language/json-pointer.js';
import type { Template } from '../../../domain/automation/language/template.js';
import { ExpressionMapper } from './expression.mapper.js';
import { TemplateMapper } from './template.mapper.js';

export class TransformMapper {
  static toDomain(
    node: string | JsonObject,
    at: JsonPointer,
  ): Expression | Template;
  static toDomain(
    node: string | JsonObject | undefined,
    at: JsonPointer,
  ): Expression | Template | null;
  static toDomain(
    node: string | JsonObject | undefined,
    at: JsonPointer,
  ): Expression | Template | null {
    if (node === undefined) return null;

    if (typeof node === 'string') return ExpressionMapper.toDomain(node, at);

    return TemplateMapper.toDomain(node, at);
  }
}
