import { UnsupportedConstructError } from '../../../../domain/errors.js';
import { UnsupportedConstruct } from '../../../../domain/automation/language/enums.js';
import type { JsonPointer } from '../../../../domain/automation/language/json-pointer.js';
import { Schema } from '../../../../domain/automation/language/schema.js';
import { SchemaFormat } from '../enums.js';
import type * as Dsl from '../interfaces.js';

export class SchemaMapper {
  static toDomain(
    node: Dsl.Schema | undefined,
    at: JsonPointer,
  ): Schema | null {
    if (node === undefined) return null;

    const document = node.document;

    if (document === undefined) {
      const resourceAt = at.at('resource');
      throw new UnsupportedConstructError(
        UnsupportedConstruct.SchemaResource,
        resourceAt,
      );
    }

    const json: string = SchemaFormat.Json;
    const format = node.format ?? json;

    if (format !== json) {
      const formatAt = at.at('format');
      throw new UnsupportedConstructError(
        UnsupportedConstruct.SchemaFormat,
        formatAt,
      );
    }

    return new Schema({ pointer: at, document });
  }
}
