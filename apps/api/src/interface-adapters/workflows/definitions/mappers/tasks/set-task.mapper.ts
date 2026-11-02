import type { TaskProps } from '../../../../../domain/automation/language/interfaces.js';
import { SetTask } from '../../../../../domain/automation/language/tasks/set-task.js';
import type * as Dsl from '../../interfaces.js';
import { TransformMapper } from '../transform.mapper.js';

export class SetTaskMapper {
  static toDomain(node: Dsl.SetTask, props: TaskProps): SetTask {
    const valueAt = props.reference.at('set');
    const value = TransformMapper.toDomain(node.set, valueAt);
    return new SetTask({
      name: props.name,
      reference: props.reference,
      base: props.base,
      value,
    });
  }
}
