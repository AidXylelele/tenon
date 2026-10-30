import type { JsonObject } from '../../../domain/automation/language/interfaces.js';
import type { JsonPointer } from '../../../domain/automation/language/json-pointer.js';
import type { ReusableComponents } from '../../../domain/automation/language/reusable-components.js';
import type { Template } from '../../../domain/automation/language/template.js';
import { TemplateMapper } from './template.mapper.js';

export class ReferenceableErrorMapper {
  static toDomain(
    node: string | JsonObject,
    at: JsonPointer,
    components: ReusableComponents,
  ): Template {
    if (typeof node === 'string') return components.error(node, at);

    return TemplateMapper.toDomain(node, at);
  }
}
