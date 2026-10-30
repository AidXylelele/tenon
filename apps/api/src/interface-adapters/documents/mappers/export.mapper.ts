import { Export } from '../../../domain/automation/language/export.js';
import type { JsonPointer } from '../../../domain/automation/language/json-pointer.js';
import type * as Dsl from '../interfaces.js';
import { TransformMapper } from './transform.mapper.js';

export class ExportMapper {
  static toDomain(node: Dsl.Output | undefined, at: JsonPointer): Export {
    if (node === undefined) return Export.none();

    const asAt = at.at('as');
    const as = TransformMapper.toDomain(node.as, asAt);
    const schema = node.schema ?? null;
    return new Export({ as, schema });
  }
}
