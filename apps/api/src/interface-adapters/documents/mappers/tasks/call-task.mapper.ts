import { UnsupportedConstructError } from '../../../../domain/errors.js';
import {
  CallKind,
  UnsupportedConstruct,
} from '../../../../domain/automation/language/enums.js';
import type { TaskProps } from '../../../../domain/automation/language/interfaces.js';
import type { ReusableComponents } from '../../../../domain/automation/language/reusable-components.js';
import type { Task } from '../../../../domain/automation/language/tasks/task.js';
import { ExcludedCallKind } from '../../enums.js';
import type * as Dsl from '../../interfaces.js';
import { FunctionCallTaskMapper } from './function-call-task.mapper.js';
import { HttpCallTaskMapper } from './http-call-task.mapper.js';
import { OpenApiCallTaskMapper } from './openapi-call-task.mapper.js';

export class CallTaskMapper {
  static readonly #CATALOG_SEPARATOR = '@';

  static toDomain(
    node: Dsl.CallTask,
    props: TaskProps,
    components: ReusableComponents,
  ): Task {
    const kinds = Object.values(CallKind);
    const kind = kinds.find((value: string) => value === node.call);

    if (kind === CallKind.Http) {
      const args = node.with as Dsl.HttpArguments;
      return HttpCallTaskMapper.toDomain(args, props, components);
    }

    if (kind === CallKind.OpenApi) {
      const args = node.with as Dsl.OpenApiArguments;
      return OpenApiCallTaskMapper.toDomain(args, props, components);
    }

    const callAt = props.reference.at('call');
    const excludedKinds: readonly string[] = Object.values(ExcludedCallKind);
    const excluded = excludedKinds.includes(node.call);

    if (excluded)
      throw new UnsupportedConstructError(
        UnsupportedConstruct.ExcludedCall,
        callAt,
      );

    const catalogued = node.call.includes(CallTaskMapper.#CATALOG_SEPARATOR);

    if (catalogued)
      throw new UnsupportedConstructError(
        UnsupportedConstruct.Catalogs,
        callAt,
      );

    return FunctionCallTaskMapper.toDomain(node, props);
  }
}
