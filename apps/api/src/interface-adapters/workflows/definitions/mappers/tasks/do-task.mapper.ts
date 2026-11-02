import type { TaskProps } from '../../../../../domain/automation/language/interfaces.js';
import type { ReusableComponents } from '../../../../../domain/automation/language/reusable-components.js';
import { DoTask } from '../../../../../domain/automation/language/tasks/do-task.js';
import type * as Dsl from '../../interfaces.js';
import { TaskListMapper } from '../task-list.mapper.js';

export class DoTaskMapper {
  static toDomain(
    node: Dsl.DoTask,
    props: TaskProps,
    components: ReusableComponents,
  ): DoTask {
    const bodyAt = props.reference.at('do');
    const body = TaskListMapper.toDomain(node.do, bodyAt, components);
    return new DoTask({
      name: props.name,
      reference: props.reference,
      base: props.base,
      body,
    });
  }
}
