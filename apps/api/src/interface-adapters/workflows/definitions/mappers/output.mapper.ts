import { Output } from '../../../../domain/automation/language/output.js';
import type { JsonPointer } from '../../../../domain/automation/language/json-pointer.js';
import type * as Dsl from '../interfaces.js';
import { SchemaMapper } from './schema.mapper.js';
import { TransformMapper } from './transform.mapper.js';

export class OutputMapper {
  static toDomain(node: Dsl.Output | undefined, at: JsonPointer): Output {
    if (node === undefined) return Output.none();

    const asAt = at.at('as');
    const as = TransformMapper.toDomain(node.as, asAt);
    const schemaAt = at.at('schema');
    const schema = SchemaMapper.toDomain(node.schema, schemaAt);
    return new Output({ as, schema });
  }
}
