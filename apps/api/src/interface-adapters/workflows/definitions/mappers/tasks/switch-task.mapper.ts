import { FlowDirective } from '../../../../../domain/automation/language/flow-directive.js';
import type { TaskProps } from '../../../../../domain/automation/language/interfaces.js';
import { SwitchCase } from '../../../../../domain/automation/language/switch-case.js';
import { SwitchTask } from '../../../../../domain/automation/language/tasks/switch-task.js';
import type * as Dsl from '../../interfaces.js';
import { ExpressionMapper } from '../expression.mapper.js';

export class SwitchTaskMapper {
  static toDomain(node: Dsl.SwitchTask, props: TaskProps): SwitchTask {
    const switchAt = props.reference.at('switch');
    const cases: SwitchCase[] = [];

    node.switch.forEach((item, index) => {
      const itemAt = switchAt.at(index);

      for (const [name, entry] of Object.entries(item)) {
        const caseAt = itemAt.at(name);
        const whenAt = caseAt.at('when');
        const when = ExpressionMapper.toDomain(entry.when, whenAt);
        const thenAt = caseAt.at('then');
        const then = FlowDirective.named(entry.then, thenAt);
        const switchCase = new SwitchCase({ reference: caseAt, when, then });
        cases.push(switchCase);
      }
    });

    return new SwitchTask({
      name: props.name,
      reference: props.reference,
      base: props.base,
      cases,
    });
  }
}
