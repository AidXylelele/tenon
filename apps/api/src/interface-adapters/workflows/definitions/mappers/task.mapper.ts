import { UnsupportedConstructError } from '../../../../domain/errors.js';
import { UnsupportedConstruct } from '../../../../domain/automation/language/enums.js';
import type { TaskProps } from '../../../../domain/automation/language/interfaces.js';
import type { JsonPointer } from '../../../../domain/automation/language/json-pointer.js';
import type { ReusableComponents } from '../../../../domain/automation/language/reusable-components.js';
import type { Task } from '../../../../domain/automation/language/tasks/task.js';
import type * as Dsl from '../interfaces.js';
import { TaskBaseMapper } from './task-base.mapper.js';
import { CallTaskMapper } from './tasks/call-task.mapper.js';
import { DoTaskMapper } from './tasks/do-task.mapper.js';
import { EmitTaskMapper } from './tasks/emit-task.mapper.js';
import { ForTaskMapper } from './tasks/for-task.mapper.js';
import { ForkTaskMapper } from './tasks/fork-task.mapper.js';
import { RaiseTaskMapper } from './tasks/raise-task.mapper.js';
import { RunTaskMapper } from './tasks/run-task.mapper.js';
import { SetTaskMapper } from './tasks/set-task.mapper.js';
import { SwitchTaskMapper } from './tasks/switch-task.mapper.js';
import { TryTaskMapper } from './tasks/try-task.mapper.js';

export class TaskMapper {
  static toDomain(
    name: string,
    node: Dsl.Task,
    at: JsonPointer,
    components: ReusableComponents,
  ): Task {
    const base = TaskBaseMapper.toDomain(node, at, components);
    const props: TaskProps = { name, reference: at, base };

    if ('call' in node) return CallTaskMapper.toDomain(node, props, components);

    if ('for' in node) return ForTaskMapper.toDomain(node, props, components);

    if ('do' in node) return DoTaskMapper.toDomain(node, props, components);

    if ('emit' in node) return EmitTaskMapper.toDomain(node, props);

    if ('fork' in node) return ForkTaskMapper.toDomain(node, props, components);

    if ('raise' in node)
      return RaiseTaskMapper.toDomain(node, props, components);

    if ('run' in node) return RunTaskMapper.toDomain(node, props);

    if ('set' in node) return SetTaskMapper.toDomain(node, props);

    if ('switch' in node) return SwitchTaskMapper.toDomain(node, props);

    if ('try' in node) return TryTaskMapper.toDomain(node, props, components);

    if ('wait' in node) {
      const waitAt = at.at('wait');
      throw new UnsupportedConstructError(
        UnsupportedConstruct.WaitTask,
        waitAt,
      );
    }

    const listenAt = at.at('listen');
    throw new UnsupportedConstructError(
      UnsupportedConstruct.ListenTask,
      listenAt,
    );
  }
}
