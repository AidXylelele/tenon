import type { WorkflowInstance } from '../../../domain/automation/instances/workflow-instance.js';
import type { Workflow } from '../../../domain/automation/workflows/workflow.js';
import type { WorkflowVersion } from '../../../domain/automation/workflows/workflow-version.js';
import type { AcceptedEvent } from '../events/ports.js';

export interface SyncScheduleCommand {
  readonly workflowId: string;
}

// An occurrence of a schedule: it names the instance it starts. A chained one (`after`) starts
// none while an instance the schedule started is still running.
export interface StartScheduledCommand {
  readonly workflowId: string;
  readonly instanceId: string;
  readonly chained: boolean;
}

// The engine's side of a workflow's schedule (US4): the occurrences of its cron or interval and
// the links of its `after` chain. The adapter reads the schedule from the version.
export abstract class WorkflowSchedules {
  abstract apply(workflow: Workflow, version: WorkflowVersion): Promise<void>;
  abstract clear(workflow: Workflow): Promise<void>;
  // In the caller's transaction: after a completed instance, the version's `after`, if any,
  // starts the next one once its delay has passed.
  abstract continueAfter(
    instance: WorkflowInstance,
    version: WorkflowVersion,
  ): Promise<void>;
}

// Whether an accepted event satisfies a version's `schedule.on`.
export abstract class EventTriggers {
  abstract accepts(
    version: WorkflowVersion,
    event: AcceptedEvent,
  ): Promise<boolean>;
}
