import { ProcessReturn } from '../../../../domain/automation/language/enums.js';
import type { TaskProps } from '../../../../domain/automation/language/interfaces.js';
import { RunShellTask } from '../../../../domain/automation/language/tasks/run-shell-task.js';
import type * as Dsl from '../../interfaces.js';
import { TemplateMapper } from '../template.mapper.js';

export class RunShellTaskMapper {
  static toDomain(node: Dsl.RunShell, props: TaskProps): RunShellTask {
    const shellAt = props.reference.at('run').at('shell');
    const shell = TemplateMapper.toDomain(node.shell, shellAt);
    const awaits = node.await ?? null;
    const processReturns = Object.values(ProcessReturn);
    const returned = processReturns.find(
      (value: string) => value === node.return,
    );
    const returns = returned ?? null;
    return new RunShellTask({
      name: props.name,
      reference: props.reference,
      base: props.base,
      shell,
      awaits,
      returns,
    });
  }
}
