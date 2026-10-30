import { ErrorProperty } from '../../../domain/automation/language/enums.js';
import { ErrorFilter } from '../../../domain/automation/language/error-filter.js';
import type * as Dsl from '../interfaces.js';

export class ErrorFilterMapper {
  static toDomain(node: Dsl.ErrorFilter | undefined): ErrorFilter {
    const properties = node?.with;

    if (properties === undefined) return ErrorFilter.none();

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
