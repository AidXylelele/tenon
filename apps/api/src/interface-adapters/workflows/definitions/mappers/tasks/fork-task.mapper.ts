import type { TaskProps } from '../../../../../domain/automation/language/interfaces.js';
import type { ReusableComponents } from '../../../../../domain/automation/language/reusable-components.js';
import { ForkTask } from '../../../../../domain/automation/language/tasks/fork-task.js';
import type * as Dsl from '../../interfaces.js';
import { TaskListMapper } from '../task-list.mapper.js';

export class ForkTaskMapper {
  static toDomain(
    node: Dsl.ForkTask,
    props: TaskProps,
    components: ReusableComponents,
  ): ForkTask {
    const branchesAt = props.reference.at('fork').at('branches');
    const branches = TaskListMapper.toDomain(
      node.fork.branches,
      branchesAt,
      components,
    );
    const compete = node.fork.compete ?? null;
    return new ForkTask({
      name: props.name,
      reference: props.reference,
      base: props.base,
      branches,
      compete,
    });
  }
}
