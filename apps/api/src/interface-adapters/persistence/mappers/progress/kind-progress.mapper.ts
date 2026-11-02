import { InconsistentProgressError } from '../../../../domain/errors.js';
import { CallingProgress } from '../../../../domain/automation/language/progress/calling-progress.js';
import { CatchProgress } from '../../../../domain/automation/language/progress/catch-progress.js';
import { DoProgress } from '../../../../domain/automation/language/progress/do-progress.js';
import { ForCheckingProgress } from '../../../../domain/automation/language/progress/for-checking-progress.js';
import { ForCollectingProgress } from '../../../../domain/automation/language/progress/for-collecting-progress.js';
import { ForIteratingProgress } from '../../../../domain/automation/language/progress/for-iterating-progress.js';
import { ForkProgress } from '../../../../domain/automation/language/progress/fork-progress.js';
import { DefinitionProgress } from '../../../../domain/automation/language/progress/definition-progress.js';
import { FunctionProgress } from '../../../../domain/automation/language/progress/function-progress.js';
import { HandlerProgress } from '../../../../domain/automation/language/progress/handler-progress.js';
import type { KindProgress } from '../../../../domain/automation/language/progress/kind-progress.js';
import { RetryProgress } from '../../../../domain/automation/language/progress/retry-progress.js';
import { RunningProgress } from '../../../../domain/automation/language/progress/running-progress.js';
import { SubWorkflowProgress } from '../../../../domain/automation/language/progress/sub-workflow-progress.js';
import { SwitchProgress } from '../../../../domain/automation/language/progress/switch-progress.js';
import { TryProgress } from '../../../../domain/automation/language/progress/try-progress.js';
import { ProgressKind } from '../../enums.js';
import type { KindProgressState } from '../../interfaces.js';
import { AttemptMapper } from './attempt.mapper.js';
import { ForIterationMapper } from './for-iteration.mapper.js';
import { SubWorkflowRequestMapper } from './sub-workflow-request.mapper.js';
import { InstantMapper } from './instant.mapper.js';
import { ProcessRunMapper } from './process-run.mapper.js';
import { SequenceMapper } from './sequence.mapper.js';
import { ServiceCallMapper } from './service-call.mapper.js';
import { WorkflowErrorMapper } from './workflow-error.mapper.js';

export class KindProgressMapper {
  static readonly #UNSTORED = 'a task body the platform does not store';

  static toState(progress: KindProgress): KindProgressState {
    if (progress instanceof DefinitionProgress)
      return { kind: ProgressKind.Definition };

    if (progress instanceof SwitchProgress)
      return { kind: ProgressKind.Switch };

    if (progress instanceof CallingProgress) {
      const call = ServiceCallMapper.toState(progress.call);
      return { kind: ProgressKind.Calling, call };
    }

    if (progress instanceof RunningProgress) {
      const run = ProcessRunMapper.toState(progress.run);
      return { kind: ProgressKind.Running, run };
    }

    if (progress instanceof FunctionProgress)
      return { kind: ProgressKind.Function };

    if (progress instanceof SubWorkflowProgress) {
      const request = SubWorkflowRequestMapper.toState(progress.request);
      return { kind: ProgressKind.SubWorkflow, request };
    }

    if (progress instanceof DoProgress) {
      const sequence = SequenceMapper.toState(progress.sequence);
      return { kind: ProgressKind.Do, sequence };
    }

    if (progress instanceof HandlerProgress) {
      const sequence = SequenceMapper.toState(progress.sequence);
      return { kind: ProgressKind.Handler, sequence };
    }

    if (progress instanceof ForCollectingProgress)
      return { kind: ProgressKind.ForCollecting };

    if (progress instanceof ForCheckingProgress) {
      const iteration = ForIterationMapper.toState(progress.iteration);
      return { kind: ProgressKind.ForChecking, iteration };
    }

    if (progress instanceof ForIteratingProgress) {
      const iteration = ForIterationMapper.toState(progress.iteration);
      const sequence = SequenceMapper.toState(progress.sequence);
      return { kind: ProgressKind.ForIterating, iteration, sequence };
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
      const due = progress.resumesAt;
      const wakeAt = InstantMapper.toState(due);
      return { kind: ProgressKind.Retry, attempt, wakeAt };
    }

    throw new InconsistentProgressError(KindProgressMapper.#UNSTORED);
  }

  static toDomain(state: KindProgressState): KindProgress {
    switch (state.kind) {
      case ProgressKind.Definition:
        return new DefinitionProgress();
      case ProgressKind.Switch:
        return new SwitchProgress();
      case ProgressKind.Calling: {
        const call = ServiceCallMapper.toDomain(state.call);
        return new CallingProgress(call);
      }
      case ProgressKind.Running: {
        const run = ProcessRunMapper.toDomain(state.run);
        return new RunningProgress(run);
      }
      case ProgressKind.Function:
        return new FunctionProgress();
      case ProgressKind.SubWorkflow: {
        const request = SubWorkflowRequestMapper.toDomain(state.request);
        return new SubWorkflowProgress(request);
      }
      case ProgressKind.Do: {
        const sequence = SequenceMapper.toDomain(state.sequence);
        return new DoProgress(sequence);
      }
      case ProgressKind.Handler: {
        const sequence = SequenceMapper.toDomain(state.sequence);
        return new HandlerProgress(sequence);
      }
      case ProgressKind.ForCollecting:
        return new ForCollectingProgress();
      case ProgressKind.ForChecking: {
        const iteration = ForIterationMapper.toDomain(state.iteration);
        return new ForCheckingProgress(iteration);
      }
      case ProgressKind.ForIterating: {
        const iteration = ForIterationMapper.toDomain(state.iteration);
        const sequence = SequenceMapper.toDomain(state.sequence);
        return new ForIteratingProgress({ iteration, sequence });
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
