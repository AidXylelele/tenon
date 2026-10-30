import { CatchClause } from '../../../domain/automation/language/catch-clause.js';
import type { JsonPointer } from '../../../domain/automation/language/json-pointer.js';
import type { ReusableComponents } from '../../../domain/automation/language/reusable-components.js';
import type * as Dsl from '../interfaces.js';
import { ErrorFilterMapper } from './error-filter.mapper.js';
import { ExpressionMapper } from './expression.mapper.js';
import { ReferenceableRetryMapper } from './referenceable-retry.mapper.js';
import { TaskListMapper } from './task-list.mapper.js';

export class CatchClauseMapper {
  static toDomain(
    node: Dsl.Catch,
    at: JsonPointer,
    components: ReusableComponents,
  ): CatchClause {
    const filter = ErrorFilterMapper.toDomain(node.errors);
    const as = node.as ?? null;
    const whenAt = at.at('when');
    const when = ExpressionMapper.toDomain(node.when, whenAt);
    const exceptWhenAt = at.at('exceptWhen');
    const exceptWhen = ExpressionMapper.toDomain(node.exceptWhen, exceptWhenAt);
    const retryAt = at.at('retry');
    const retry = ReferenceableRetryMapper.toDomain(
      node.retry,
      retryAt,
      components,
    );
    const handlerAt = at.at('do');
    const handler = TaskListMapper.toDomain(node.do, handlerAt, components);
    return new CatchClause({ filter, as, when, exceptWhen, retry, handler });
  }
}
