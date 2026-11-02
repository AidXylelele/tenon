import type { AdvancedInstanceResult } from '../../../../application/automation/instances/ports.js';
import { InstanceProgressKind } from '../../../../domain/automation/instances/enums.js';
import { RoundProgressKind } from '../enums.js';
import type { RoundProgress } from '../interfaces.js';

export class RoundProgressMapper {
  static readonly #KINDS: Readonly<
    Record<InstanceProgressKind, RoundProgressKind>
  > = {
    [InstanceProgressKind.Run]: RoundProgressKind.Run,
    [InstanceProgressKind.Park]: RoundProgressKind.Park,
    [InstanceProgressKind.Ended]: RoundProgressKind.Ended,
  };

  static toRound(advanced: AdvancedInstanceResult): RoundProgress {
    const progress = advanced.progress;
    const ended = progress.kind === InstanceProgressKind.Ended;
    const busy = !ended && advanced.deferred > 0;
    const declared = RoundProgressMapper.#KINDS[progress.kind];
    const kind = busy ? RoundProgressKind.Busy : declared;
    const wakeAt = progress.wakeAt?.getTime() ?? null;
    return { kind, wakeAt, subWorkflows: progress.subWorkflows };
  }
}
