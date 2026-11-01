import type { TaskProps } from '../../../../domain/automation/language/interfaces.js';
import { EmitTask } from '../../../../domain/automation/language/tasks/emit-task.js';
import type * as Dsl from '../../interfaces.js';
import { KnownPropertiesMapper } from '../known-properties.mapper.js';
import { TemplateMapper } from '../template.mapper.js';

export class EmitTaskMapper {
  static readonly #EVENT: readonly string[] = ['with'];

  static toDomain(node: Dsl.EmitTask, props: TaskProps): EmitTask {
    const eventAt = props.reference.at('emit').at('event');
    KnownPropertiesMapper.confirm(
      node.emit.event,
      EmitTaskMapper.#EVENT,
      eventAt,
    );
    const properties = node.emit.event.with ?? {};
    const withAt = eventAt.at('with');
    const event = TemplateMapper.toDomain(properties, withAt);
    return new EmitTask({
      name: props.name,
      reference: props.reference,
      base: props.base,
      event,
    });
  }
}
