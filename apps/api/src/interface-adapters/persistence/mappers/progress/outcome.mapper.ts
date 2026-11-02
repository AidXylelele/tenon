import { Outcome } from '../../../../domain/automation/language/outcome.js';
import type { OutcomeState } from '../../interfaces.js';
import { CloudEventMapper } from './cloud-event.mapper.js';
import { DetachedWorkflowMapper } from './detached-workflow.mapper.js';
import { FlowDirectiveMapper } from './flow-directive.mapper.js';
import { ProcessRunMapper } from './process-run.mapper.js';
import { WorkflowErrorMapper } from './workflow-error.mapper.js';

export class OutcomeMapper {
  static toState(outcome: Outcome): OutcomeState;
  static toState(outcome: Outcome | null): OutcomeState | null;
  static toState(outcome: Outcome | null): OutcomeState | null {
    if (outcome === null) return null;

    const failure = WorkflowErrorMapper.toState(outcome.failure);
    const directive = FlowDirectiveMapper.toState(outcome.directive);
    const emitted = CloudEventMapper.toState(outcome.emitted);
    const detachedWorkflow = DetachedWorkflowMapper.toState(
      outcome.detachedWorkflow,
    );
    const detachedProcess = ProcessRunMapper.toState(outcome.detachedProcess);
    return {
      output: outcome.output,
      failure,
      directive,
      authorization: outcome.authorization,
      emitted,
      detachedProcess,
      detachedWorkflow,
    };
  }

  static toDomain(state: OutcomeState): Outcome;
  static toDomain(state: OutcomeState | null): Outcome | null;
  static toDomain(state: OutcomeState | null): Outcome | null {
    if (state === null) return null;

    const failure = WorkflowErrorMapper.toDomain(state.failure);
    const directive = FlowDirectiveMapper.toDomain(state.directive);
    const emitted = CloudEventMapper.toDomain(state.emitted);
    const detachedWorkflow = DetachedWorkflowMapper.toDomain(
      state.detachedWorkflow,
    );
    const detachedProcess = ProcessRunMapper.toDomain(state.detachedProcess);
    return new Outcome({
      output: state.output,
      failure,
      directive,
      authorization: state.authorization,
      emitted,
      detachedProcess,
      detachedWorkflow,
    });
  }
}
