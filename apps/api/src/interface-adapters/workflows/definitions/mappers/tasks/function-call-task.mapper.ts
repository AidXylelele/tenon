import type { TaskProps } from '../../../../../domain/automation/language/interfaces.js';
import { FunctionCallTask } from '../../../../../domain/automation/language/tasks/function-call-task.js';
import type * as Dsl from '../../interfaces.js';
import { TemplateMapper } from '../template.mapper.js';

export class FunctionCallTaskMapper {
  static toDomain(node: Dsl.CallTask, props: TaskProps): FunctionCallTask {
    const argumentsAt = props.reference.at('with');
    const args = TemplateMapper.toDomain(node.with, argumentsAt);
    return new FunctionCallTask({
      name: props.name,
      reference: props.reference,
      base: props.base,
      function: node.call,
      arguments: args,
    });
  }
}
