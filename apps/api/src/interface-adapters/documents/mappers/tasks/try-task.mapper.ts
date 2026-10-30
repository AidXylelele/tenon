import type { TaskProps } from '../../../../domain/automation/language/interfaces.js';
import type { ReusableComponents } from '../../../../domain/automation/language/reusable-components.js';
import { TryTask } from '../../../../domain/automation/language/tasks/try-task.js';
import type * as Dsl from '../../interfaces.js';
import { CatchClauseMapper } from '../catch-clause.mapper.js';
import { TaskListMapper } from '../task-list.mapper.js';

export class TryTaskMapper {
  static toDomain(
    node: Dsl.TryTask,
    props: TaskProps,
    components: ReusableComponents,
  ): TryTask {
    const bodyAt = props.reference.at('try');
    const body = TaskListMapper.toDomain(node.try, bodyAt, components);
    const catchAt = props.reference.at('catch');
    const catchClause = CatchClauseMapper.toDomain(
      node.catch,
      catchAt,
      components,
    );
    return new TryTask({
      name: props.name,
      reference: props.reference,
      base: props.base,
      body,
      catchClause,
    });
  }
}
