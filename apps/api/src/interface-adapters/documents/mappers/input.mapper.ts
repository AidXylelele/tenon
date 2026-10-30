import { Input } from '../../../domain/automation/language/input.js';
import type { JsonPointer } from '../../../domain/automation/language/json-pointer.js';
import type * as Dsl from '../interfaces.js';
import { TransformMapper } from './transform.mapper.js';

export class InputMapper {
  static toDomain(node: Dsl.Input | undefined, at: JsonPointer): Input {
    if (node === undefined) return Input.none();

    const fromAt = at.at('from');
    const from = TransformMapper.toDomain(node.from, fromAt);
    const schema = node.schema ?? null;
    return new Input({ from, schema });
  }
}
