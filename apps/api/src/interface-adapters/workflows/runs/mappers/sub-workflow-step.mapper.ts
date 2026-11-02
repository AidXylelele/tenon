import { SubWorkflowStartKind } from '../../../../application/automation/instances/enums.js';
import type { StartedSubWorkflowResult } from '../../../../application/automation/instances/ports.js';
import { SubWorkflowStepKind } from '../enums.js';

export class SubWorkflowStepMapper {
  static readonly #KINDS: Readonly<
    Record<SubWorkflowStartKind, SubWorkflowStepKind>
  > = {
    [SubWorkflowStartKind.Started]: SubWorkflowStepKind.Started,
    [SubWorkflowStartKind.Answered]: SubWorkflowStepKind.Answered,
  };

  static toStep(result: StartedSubWorkflowResult): SubWorkflowStepKind {
    return SubWorkflowStepMapper.#KINDS[result.kind];
  }
}
