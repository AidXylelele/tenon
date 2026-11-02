import { UnsupportedConstructError } from '../../../../../domain/errors.js';
import { UnsupportedConstruct } from '../../../../../domain/automation/language/enums.js';
import type { TaskProps } from '../../../../../domain/automation/language/interfaces.js';
import { RunWorkflowTask } from '../../../../../domain/automation/language/tasks/run-workflow-task.js';
import { WorkflowName } from '../../../../../domain/automation/language/workflow-name.js';
import { WorkflowTarget } from '../../../../../domain/automation/language/workflow-target.js';
import type * as Dsl from '../../interfaces.js';
import { TemplateMapper } from '../template.mapper.js';

export class RunWorkflowTaskMapper {
  static toDomain(node: Dsl.RunWorkflow, props: TaskProps): RunWorkflowTask {
    if (node.return !== undefined) {
      const returnAt = props.reference.at('run').at('return');
      throw new UnsupportedConstructError(
        UnsupportedConstruct.WorkflowReturn,
        returnAt,
      );
    }

    const subflow = node.workflow;
    const workflow = new WorkflowName(subflow.namespace, subflow.name);
    const target = new WorkflowTarget(workflow, subflow.version);
    const inputAt = props.reference.at('run').at('workflow').at('input');
    const input = TemplateMapper.toDomain(subflow.input, inputAt);
    const awaits = node.await ?? null;
    return new RunWorkflowTask({
      name: props.name,
      reference: props.reference,
      base: props.base,
      target,
      input,
      awaits,
    });
  }
}
