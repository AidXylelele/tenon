import type { TaskProps } from '../../../../../domain/automation/language/interfaces.js';
import { RunShellTask } from '../../../../../domain/automation/language/tasks/run-shell-task.js';
import type * as Dsl from '../../interfaces.js';
import { ProcessReturnMapper } from '../process-return.mapper.js';
import { TemplateMapper } from '../template.mapper.js';

export class RunShellTaskMapper {
  static toDomain(node: Dsl.RunShell, props: TaskProps): RunShellTask {
    const runAt = props.reference.at('run');
    const shellAt = runAt.at('shell');
    const shell = TemplateMapper.toDomain(node.shell, shellAt);
    const awaits = node.await ?? null;
    const returns = ProcessReturnMapper.toDomain(node.return, runAt);
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
