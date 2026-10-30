import { UnsupportedConstructError } from '../../../../domain/errors.js';
import { UnsupportedConstruct } from '../../../../domain/automation/language/enums.js';
import type { TaskProps } from '../../../../domain/automation/language/interfaces.js';
import type { Task } from '../../../../domain/automation/language/task.js';
import type * as Dsl from '../../interfaces.js';
import { RunScriptTaskMapper } from './run-script-task.mapper.js';
import { RunShellTaskMapper } from './run-shell-task.mapper.js';
import { RunWorkflowTaskMapper } from './run-workflow-task.mapper.js';

export class RunTaskMapper {
  static toDomain(node: Dsl.RunTask, props: TaskProps): Task {
    const run = node.run;

    if ('workflow' in run) return RunWorkflowTaskMapper.toDomain(run, props);

    if ('script' in run) return RunScriptTaskMapper.toDomain(run, props);

    if ('shell' in run) return RunShellTaskMapper.toDomain(run, props);

    const containerAt = props.reference.at('run').at('container');
    throw new UnsupportedConstructError(
      UnsupportedConstruct.Container,
      containerAt,
    );
  }
}
