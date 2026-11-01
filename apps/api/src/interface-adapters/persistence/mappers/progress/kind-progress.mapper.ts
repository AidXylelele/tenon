import { InconsistentProgressError } from '../../../../domain/errors.js';
import { CallProgress } from '../../../../domain/automation/language/progress/call-progress.js';
import { CatchProgress } from '../../../../domain/automation/language/progress/catch-progress.js';
import { DoProgress } from '../../../../domain/automation/language/progress/do-progress.js';
import { ForProgress } from '../../../../domain/automation/language/progress/for-progress.js';
import { ForkProgress } from '../../../../domain/automation/language/progress/fork-progress.js';
import { FunctionCallProgress } from '../../../../domain/automation/language/progress/function-call-progress.js';
import { HandlerProgress } from '../../../../domain/automation/language/progress/handler-progress.js';
import type { KindProgress } from '../../../../domain/automation/language/progress/kind-progress.js';
import { ProcessProgress } from '../../../../domain/automation/language/progress/process-progress.js';
import { RetryProgress } from '../../../../domain/automation/language/progress/retry-progress.js';
import { RunWorkflowProgress } from '../../../../domain/automation/language/progress/run-workflow-progress.js';
import { SwitchProgress } from '../../../../domain/automation/language/progress/switch-progress.js';
import { TryProgress } from '../../../../domain/automation/language/progress/try-progress.js';
import { ValueProgress } from '../../../../domain/automation/language/progress/value-progress.js';
import { ProgressKind } from '../../enums.js';
import type { KindProgressState } from '../../interfaces.js';
import { AttemptMapper } from './attempt.mapper.js';
import { SubWorkflowRequestMapper } from './sub-workflow-request.mapper.js';
import { InstantMapper } from './instant.mapper.js';
import { ProcessRunMapper } from './process-run.mapper.js';
import { SequenceMapper } from './sequence.mapper.js';
import { ServiceCallMapper } from './service-call.mapper.js';
import { WorkflowErrorMapper } from './workflow-error.mapper.js';

export class KindProgressMapper {
  static readonly #UNSTORED = 'a task body the platform does not store';

  static toState(progress: KindProgress): KindProgressState {
    if (progress instanceof ValueProgress) return { kind: ProgressKind.Value };

    if (progress instanceof SwitchProgress)
      return { kind: ProgressKind.Switch };

    if (progress instanceof CallProgress) {
      const call = ServiceCallMapper.toState(progress.call);
      return { kind: ProgressKind.Call, call };
    }

    if (progress instanceof ProcessProgress) {
      const run = ProcessRunMapper.toState(progress.run);
      return { kind: ProgressKind.Process, run };
    }

    if (progress instanceof FunctionCallProgress)
      return { kind: ProgressKind.FunctionCall, started: progress.started };

    if (progress instanceof RunWorkflowProgress) {
      const request = SubWorkflowRequestMapper.toState(progress.subWorkflow());
      return { kind: ProgressKind.RunWorkflow, request };
    }

    if (progress instanceof DoProgress) {
      const sequence = SequenceMapper.toState(progress.sequence);
      return { kind: ProgressKind.Do, sequence };
    }

    if (progress instanceof HandlerProgress) {
      const sequence = SequenceMapper.toState(progress.sequence);
      return { kind: ProgressKind.Handler, sequence };
    }

    if (progress instanceof ForProgress) {
      const sequence = SequenceMapper.toState(progress.sequence);
      return {
        kind: ProgressKind.For,
        items: progress.items,
        index: progress.index,
        data: progress.data,
        sequence,
      };
    }

    if (progress instanceof ForkProgress)
      return {
        kind: ProgressKind.Fork,
        outputs: progress.outputs,
        pending: progress.pending,
      };

    if (progress instanceof TryProgress) {
      const attempt = AttemptMapper.toState(progress.attempt);
      const sequence = SequenceMapper.toState(progress.sequence);
      return { kind: ProgressKind.Try, attempt, sequence };
    }

    if (progress instanceof CatchProgress) {
      const attempt = AttemptMapper.toState(progress.attempt);
      const error = WorkflowErrorMapper.toState(progress.error);
      return { kind: ProgressKind.Catch, attempt, error };
    }

    if (progress instanceof RetryProgress) {
      const attempt = AttemptMapper.toState(progress.attempt);
      const due = progress.wakeAt();
      const wakeAt = InstantMapper.toState(due);
      return { kind: ProgressKind.Retry, attempt, wakeAt };
    }

    throw new InconsistentProgressError(KindProgressMapper.#UNSTORED);
  }

  static toDomain(state: KindProgressState): KindProgress {
    switch (state.kind) {
      case ProgressKind.Value:
        return new ValueProgress();
      case ProgressKind.Switch:
        return new SwitchProgress();
      case ProgressKind.Call: {
        const call = ServiceCallMapper.toDomain(state.call);
        return new CallProgress(call);
      }
      case ProgressKind.Process: {
        const run = ProcessRunMapper.toDomain(state.run);
        return new ProcessProgress(run);
      }
      case ProgressKind.FunctionCall:
        return new FunctionCallProgress(state.started);
      case ProgressKind.RunWorkflow: {
        const request = SubWorkflowRequestMapper.toDomain(state.request);
        return new RunWorkflowProgress(request);
      }
      case ProgressKind.Do: {
        const sequence = SequenceMapper.toDomain(state.sequence);
        return new DoProgress(sequence);
      }
      case ProgressKind.Handler: {
        const sequence = SequenceMapper.toDomain(state.sequence);
        return new HandlerProgress(sequence);
      }
      case ProgressKind.For: {
        const sequence = SequenceMapper.toDomain(state.sequence);
        return new ForProgress({
          items: state.items,
          index: state.index,
          data: state.data,
          sequence,
        });
      }
      case ProgressKind.Fork:
        return new ForkProgress({
          outputs: state.outputs,
          pending: state.pending,
        });
      case ProgressKind.Try: {
        const attempt = AttemptMapper.toDomain(state.attempt);
        const sequence = SequenceMapper.toDomain(state.sequence);
        return new TryProgress({ attempt, sequence });
      }
      case ProgressKind.Catch: {
        const attempt = AttemptMapper.toDomain(state.attempt);
        const error = WorkflowErrorMapper.toDomain(state.error);
        return new CatchProgress({ attempt, error });
      }
      case ProgressKind.Retry: {
        const attempt = AttemptMapper.toDomain(state.attempt);
        const wakeAt = InstantMapper.toDomain(state.wakeAt);
        return new RetryProgress({ attempt, wakeAt });
      }
      default:
        throw new InconsistentProgressError(KindProgressMapper.#UNSTORED);
    }
  }
}
