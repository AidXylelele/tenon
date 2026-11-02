import { FlowDirective } from '../../../../domain/automation/language/flow-directive.js';
import type { JsonPointer } from '../../../../domain/automation/language/json-pointer.js';
import type { ReusableComponents } from '../../../../domain/automation/language/reusable-components.js';
import { TaskBase } from '../../../../domain/automation/language/task-base.js';
import type * as Dsl from '../interfaces.js';
import { ExportMapper } from './export.mapper.js';
import { ExpressionMapper } from './expression.mapper.js';
import { InputMapper } from './input.mapper.js';
import { OutputMapper } from './output.mapper.js';
import { ReferenceableTimeoutMapper } from './referenceable-timeout.mapper.js';

export class TaskBaseMapper {
  static toDomain(
    node: Dsl.TaskBase,
    at: JsonPointer,
    components: ReusableComponents,
  ): TaskBase {
    const conditionAt = at.at('if');
    const condition = ExpressionMapper.toDomain(node.if, conditionAt);
    const inputAt = at.at('input');
    const input = InputMapper.toDomain(node.input, inputAt);
    const outputAt = at.at('output');
    const output = OutputMapper.toDomain(node.output, outputAt);
    const exportAt = at.at('export');
    const exported = ExportMapper.toDomain(node.export, exportAt);
    const timeoutAt = at.at('timeout');
    const timeout = ReferenceableTimeoutMapper.toDomain(
      node.timeout,
      timeoutAt,
      components,
    );
    const thenAt = at.at('then');
    const then = FlowDirective.named(node.then, thenAt);
    return new TaskBase({
      condition,
      input,
      output,
      export: exported,
      timeout,
      then,
    });
  }
}
