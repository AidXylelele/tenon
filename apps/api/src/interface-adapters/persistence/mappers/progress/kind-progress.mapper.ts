import { ValueProgress } from '../../../../domain/automation/language/progress/value-progress.js';
import { CallProgress } from '../../../../domain/automation/language/progress/call-progress.js';
import { ProcessProgress } from '../../../../domain/automation/language/progress/process-progress.js';
import { FunctionCallProgress } from '../../../../domain/automation/language/progress/function-call-progress.js';
import { RunWorkflowProgress } from '../../../../domain/automation/language/progress/run-workflow-progress.js';
import { DoProgress } from '../../../../domain/automation/language/progress/do-progress.js';
import { ForProgress } from '../../../../domain/automation/language/progress/for-progress.js';
import { ForkProgress } from '../../../../domain/automation/language/progress/fork-progress.js';
import { SwitchProgress } from '../../../../domain/automation/language/progress/switch-progress.js';
import { TryProgress } from '../../../../domain/automation/language/progress/try-progress.js';
import { CatchProgress } from '../../../../domain/automation/language/progress/catch-progress.js';
import { RetryProgress } from '../../../../domain/automation/language/progress/retry-progress.js';
import { HandlerProgress } from '../../../../domain/automation/language/progress/handler-progress.js';
import { ConcludedProgress } from '../../../../domain/automation/language/progress/concluded-progress.js';
import type { KindProgress } from '../../../../domain/automation/language/progress/kind-progress.js';
import { ProgressKind } from '../../enums.js';
import type { KindProgressState } from '../../interfaces.js';
import { ValueProgressMapper } from './value-progress.mapper.js';
import { CallProgressMapper } from './call-progress.mapper.js';
import { ProcessProgressMapper } from './process-progress.mapper.js';
import { FunctionCallProgressMapper } from './function-call-progress.mapper.js';
import { RunWorkflowProgressMapper } from './run-workflow-progress.mapper.js';
import { DoProgressMapper } from './do-progress.mapper.js';
import { ForProgressMapper } from './for-progress.mapper.js';
import { ForkProgressMapper } from './fork-progress.mapper.js';
import { SwitchProgressMapper } from './switch-progress.mapper.js';
import { TryProgressMapper } from './try-progress.mapper.js';
import { CatchProgressMapper } from './catch-progress.mapper.js';
import { RetryProgressMapper } from './retry-progress.mapper.js';
import { HandlerProgressMapper } from './handler-progress.mapper.js';
import { ConcludedProgressMapper } from './concluded-progress.mapper.js';

export class KindProgressMapper {
  static toState(progress: KindProgress): KindProgressState {
    if (progress instanceof ValueProgress)
      return ValueProgressMapper.toState(progress);

    if (progress instanceof CallProgress)
      return CallProgressMapper.toState(progress);

    if (progress instanceof ProcessProgress)
      return ProcessProgressMapper.toState(progress);

    if (progress instanceof FunctionCallProgress)
      return FunctionCallProgressMapper.toState(progress);

    if (progress instanceof RunWorkflowProgress)
      return RunWorkflowProgressMapper.toState(progress);

    if (progress instanceof DoProgress)
      return DoProgressMapper.toState(progress);

    if (progress instanceof ForProgress)
      return ForProgressMapper.toState(progress);

    if (progress instanceof ForkProgress)
      return ForkProgressMapper.toState(progress);

    if (progress instanceof SwitchProgress)
      return SwitchProgressMapper.toState(progress);

    if (progress instanceof TryProgress)
      return TryProgressMapper.toState(progress);

    if (progress instanceof CatchProgress)
      return CatchProgressMapper.toState(progress);

    if (progress instanceof RetryProgress)
      return RetryProgressMapper.toState(progress);

    if (progress instanceof HandlerProgress)
      return HandlerProgressMapper.toState(progress);

    if (progress instanceof ConcludedProgress)
      return ConcludedProgressMapper.toState(progress);

    throw new Error('A kind of progress the progress mapper does not know');
  }

  static toDomain(state: KindProgressState): KindProgress {
    if (state.kind === ProgressKind.Value)
      return ValueProgressMapper.toDomain(state);

    if (state.kind === ProgressKind.Call)
      return CallProgressMapper.toDomain(state);

    if (state.kind === ProgressKind.Process)
      return ProcessProgressMapper.toDomain(state);

    if (state.kind === ProgressKind.FunctionCall)
      return FunctionCallProgressMapper.toDomain(state);

    if (state.kind === ProgressKind.RunWorkflow)
      return RunWorkflowProgressMapper.toDomain(state);

    if (state.kind === ProgressKind.Do) return DoProgressMapper.toDomain(state);

    if (state.kind === ProgressKind.For)
      return ForProgressMapper.toDomain(state);

    if (state.kind === ProgressKind.Fork)
      return ForkProgressMapper.toDomain(state);

    if (state.kind === ProgressKind.Switch)
      return SwitchProgressMapper.toDomain(state);

    if (state.kind === ProgressKind.Try)
      return TryProgressMapper.toDomain(state);

    if (state.kind === ProgressKind.Catch)
      return CatchProgressMapper.toDomain(state);

    if (state.kind === ProgressKind.Retry)
      return RetryProgressMapper.toDomain(state);

    if (state.kind === ProgressKind.Handler)
      return HandlerProgressMapper.toDomain(state);

    return ConcludedProgressMapper.toDomain(state);
  }
}
