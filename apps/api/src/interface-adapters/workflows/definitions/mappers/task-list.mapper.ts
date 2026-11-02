import type { JsonPointer } from '../../../../domain/automation/language/json-pointer.js';
import type { ReusableComponents } from '../../../../domain/automation/language/reusable-components.js';
import type { Task } from '../../../../domain/automation/language/tasks/task.js';
import { TaskList } from '../../../../domain/automation/language/task-list.js';
import type * as Dsl from '../interfaces.js';
import { TaskMapper } from './task.mapper.js';

export class TaskListMapper {
  static toDomain(
    node: Dsl.TaskList,
    at: JsonPointer,
    components: ReusableComponents,
  ): TaskList;
  static toDomain(
    node: Dsl.TaskList | undefined,
    at: JsonPointer,
    components: ReusableComponents,
  ): TaskList | null;
  static toDomain(
    node: Dsl.TaskList | undefined,
    at: JsonPointer,
    components: ReusableComponents,
  ): TaskList | null {
    if (node === undefined) return null;

    const tasks: Task[] = [];

    node.forEach((item, index) => {
      const itemAt = at.at(index);

      for (const [name, entry] of Object.entries(item)) {
        const taskAt = itemAt.at(name);
        const task = TaskMapper.toDomain(name, entry, taskAt, components);
        tasks.push(task);
      }
    });

    return new TaskList({ reference: at, tasks });
  }
}
