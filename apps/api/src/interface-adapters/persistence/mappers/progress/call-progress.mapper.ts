import { CallProgress } from '../../../../domain/automation/language/progress/call-progress.js';
import { ProgressKind } from '../../enums.js';
import type { CallProgressState } from '../../interfaces.js';
import { ServiceCallMapper } from './service-call.mapper.js';

export class CallProgressMapper {
  static toState(progress: CallProgress): CallProgressState {
    const call = ServiceCallMapper.toState(progress.call);
    return { kind: ProgressKind.Call, input: progress.input, call };
  }

  static toDomain(state: CallProgressState): CallProgress {
    const call = ServiceCallMapper.toDomain(state.call);
    return new CallProgress({ input: state.input, call });
  }
}
