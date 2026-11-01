import { ErrorProperty } from '../../../domain/automation/language/enums.js';
import { ErrorFilter } from '../../../domain/automation/language/error-filter.js';
import type { JsonPointer } from '../../../domain/automation/language/json-pointer.js';
import type * as Dsl from '../interfaces.js';
import { KnownPropertiesMapper } from './known-properties.mapper.js';

export class ErrorFilterMapper {
  static readonly #FILTER: readonly string[] = ['with'];
  static readonly #PROPERTIES: readonly string[] = [
    'type',
    'status',
    'instance',
    'title',
    'details',
  ];

  static toDomain(
    node: Dsl.ErrorFilter | undefined,
    at: JsonPointer,
  ): ErrorFilter {
    if (node === undefined) return ErrorFilter.none();

    KnownPropertiesMapper.confirm(node, ErrorFilterMapper.#FILTER, at);
    const properties = node.with;

    if (properties === undefined) return ErrorFilter.none();

    const withAt = at.at('with');
    KnownPropertiesMapper.confirm(
      properties,
      ErrorFilterMapper.#PROPERTIES,
      withAt,
    );
    const expected = new Map<ErrorProperty, string | number>();

    if (properties.type !== undefined)
      expected.set(ErrorProperty.Type, properties.type);

    if (properties.status !== undefined)
      expected.set(ErrorProperty.Status, properties.status);

    if (properties.instance !== undefined)
      expected.set(ErrorProperty.Instance, properties.instance);

    if (properties.title !== undefined)
      expected.set(ErrorProperty.Title, properties.title);

    if (properties.details !== undefined)
      expected.set(ErrorProperty.Detail, properties.details);

    return new ErrorFilter(expected);
  }
}
