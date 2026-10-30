import { UnsupportedConstructError } from '../../../domain/errors.js';
import { Definition } from '../../../domain/automation/language/definition.js';
import { UnsupportedConstruct } from '../../../domain/automation/language/enums.js';
import { JsonPointer } from '../../../domain/automation/language/json-pointer.js';
import { WorkflowName } from '../../../domain/automation/language/workflow-name.js';
import type * as Dsl from '../interfaces.js';
import { InputMapper } from './input.mapper.js';
import { OutputMapper } from './output.mapper.js';
import { ReferenceableTimeoutMapper } from './referenceable-timeout.mapper.js';
import { ReusableComponentsMapper } from './reusable-components.mapper.js';
import { TaskListMapper } from './task-list.mapper.js';

export class DefinitionMapper {
  static toDomain(node: Dsl.Workflow): Definition {
    const root = JsonPointer.root();

    if (node.schedule !== undefined) {
      const scheduleAt = root.at('schedule');
      throw new UnsupportedConstructError(
        UnsupportedConstruct.Schedule,
        scheduleAt,
      );
    }

    const document = node.document;
    const useAt = root.at('use');
    const components = ReusableComponentsMapper.toDomain(node.use, useAt);
    const workflow = new WorkflowName(document.namespace, document.name);
    const inputAt = root.at('input');
    const input = InputMapper.toDomain(node.input, inputAt);
    const outputAt = root.at('output');
    const output = OutputMapper.toDomain(node.output, outputAt);
    const timeoutAt = root.at('timeout');
    const timeout = ReferenceableTimeoutMapper.toDomain(
      node.timeout,
      timeoutAt,
      components,
    );
    const bodyAt = root.at('do');
    const body = TaskListMapper.toDomain(node.do, bodyAt, components);
    return new Definition({
      workflow,
      version: document.version,
      dslVersion: document.dsl,
      input,
      output,
      timeout,
      body,
      components,
    });
  }
}
