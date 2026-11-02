import type { TaskProps } from '../../../../../domain/automation/language/interfaces.js';
import type { ReusableComponents } from '../../../../../domain/automation/language/reusable-components.js';
import { ForTask } from '../../../../../domain/automation/language/tasks/for-task.js';
import type * as Dsl from '../../interfaces.js';
import { ExpressionMapper } from '../expression.mapper.js';
import { TaskListMapper } from '../task-list.mapper.js';

export class ForTaskMapper {
  static toDomain(
    node: Dsl.ForTask,
    props: TaskProps,
    components: ReusableComponents,
  ): ForTask {
    const loop = node.for;
    const each = loop.each ?? null;
    const position = loop.at ?? null;
    const collectionAt = props.reference.at('for').at('in');
    const collection = ExpressionMapper.toDomain(loop.in, collectionAt);
    const whilstAt = props.reference.at('while');
    const whilst = ExpressionMapper.toDomain(node.while, whilstAt);
    const bodyAt = props.reference.at('do');
    const body = TaskListMapper.toDomain(node.do, bodyAt, components);
    return new ForTask({
      name: props.name,
      reference: props.reference,
      base: props.base,
      each,
      at: position,
      collection,
      whilst,
      body,
    });
  }
}
