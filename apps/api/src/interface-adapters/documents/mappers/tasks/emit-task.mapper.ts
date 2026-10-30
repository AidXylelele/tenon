import type { TaskProps } from '../../../../domain/automation/language/interfaces.js';
import { EmitTask } from '../../../../domain/automation/language/tasks/emit-task.js';
import type * as Dsl from '../../interfaces.js';
import { TemplateMapper } from '../template.mapper.js';

export class EmitTaskMapper {
  static toDomain(node: Dsl.EmitTask, props: TaskProps): EmitTask {
    const eventAt = props.reference.at('emit').at('event').at('with');
    const event = TemplateMapper.toDomain(node.emit.event.with, eventAt);
    return new EmitTask({
      name: props.name,
      reference: props.reference,
      base: props.base,
      event,
    });
  }
}
