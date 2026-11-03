import type { Specification } from '@openworkflowspec/sdk';
import type { JsonObject } from '../../domain/automation/json.js';
import { TimingKind } from '../../interface-adapters/workflows/enums.js';
import type {
  ScheduleTiming,
  TimingClient,
} from '../../interface-adapters/workflows/interfaces.js';
import { Durations } from './document/durations.js';

// A document's `schedule` timing: its cron (in UTC), or the length of its `every` or `after`;
// publish refused a duration it cannot compute.
export class RuntimeTimingClient implements TimingClient {
  timingOf(document: JsonObject): ScheduleTiming | null {
    const workflow = document as unknown as Specification.Workflow;
    const schedule = workflow.schedule ?? {};

    if (schedule.cron !== undefined)
      return { kind: TimingKind.Cron, cron: schedule.cron };

    if (schedule.every !== undefined) {
      const everyMs = Durations.millisecondsOf(schedule.every);
      return { kind: TimingKind.Every, everyMs };
    }

    if (schedule.after !== undefined) {
      const afterMs = Durations.millisecondsOf(schedule.after);
      return { kind: TimingKind.After, afterMs };
    }

    return null;
  }
}
