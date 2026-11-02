import type { Origin } from '../../../domain/automation/instances/interfaces.js';
import { ParentOrigin } from '../../../domain/automation/instances/origins/parent-origin.js';
import { UserOrigin } from '../../../domain/automation/instances/origins/user-origin.js';
import { OriginKind } from '../schema/enums.js';
import type { OriginState } from '../schema/interfaces.js';

export class OriginMapper {
  static toState(origin: Origin): OriginState {
    if (origin instanceof UserOrigin)
      return { kind: OriginKind.User, userId: origin.userId };

    return {
      kind: OriginKind.Parent,
      instanceId: origin.instanceId,
      taskId: origin.taskId,
    };
  }

  static toDomain(state: OriginState): Origin {
    if (state.kind === OriginKind.User) return new UserOrigin(state.userId);

    return new ParentOrigin(state.instanceId, state.taskId);
  }
}
