import type { TaskProps } from '../../../../domain/automation/language/interfaces.js';
import type { ReusableComponents } from '../../../../domain/automation/language/reusable-components.js';
import { RaiseTask } from '../../../../domain/automation/language/tasks/raise-task.js';
import type * as Dsl from '../../interfaces.js';
import { ReferenceableErrorMapper } from '../referenceable-error.mapper.js';

export class RaiseTaskMapper {
  static toDomain(
    node: Dsl.RaiseTask,
    props: TaskProps,
    components: ReusableComponents,
  ): RaiseTask {
    const errorAt = props.reference.at('raise').at('error');
    const error = ReferenceableErrorMapper.toDomain(
      node.raise.error,
      errorAt,
      components,
    );
    return new RaiseTask({
      name: props.name,
      reference: props.reference,
      base: props.base,
      error,
    });
  }
}
