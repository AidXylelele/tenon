import { Injectable } from '@nestjs/common';
import { TriggerKind } from '../../../domain/automation/instances/enums.js';
import { EventStore } from '../events/ports.js';
import {
  InstanceRuns,
  WorkflowInstanceRepository,
} from '../instances/ports.js';
import { Clock } from '../ports.js';
import {
  WorkflowRepository,
  WorkflowVersionRepository,
} from '../workflows/ports.js';
import { EventTriggers } from './ports.js';

export interface StartOnEventCommand {
  readonly sequence: number;
}

// An accepted event starts one instance of every workflow that is on whose `schedule.on` it
// satisfies, with the consumed events as its input (US4 AS3). Its consumer's inbox, in the
// same transaction, makes a redelivered event start none.
@Injectable()
export class StartOnEvent {
  constructor(
    private readonly events: EventStore,
    private readonly workflows: WorkflowRepository,
    private readonly versions: WorkflowVersionRepository,
    private readonly instances: WorkflowInstanceRepository,
    private readonly runs: InstanceRuns,
    private readonly triggers: EventTriggers,
    private readonly clock: Clock,
  ) {}

  async execute(command: StartOnEventCommand): Promise<void> {
    const now = this.clock.now();
    const event = await this.events.find(command.sequence);

    if (event === null) return;

    const type = event.cloudEvent.type as string;
    const candidates = await this.versions.findStartedOn(type);

    for (const version of candidates) {
      const accepts = await this.triggers.accepts(version, event);

      if (!accepts) continue;

      const workflow = await this.workflows.findById(version.workflowId);

      if (workflow === null) continue;

      const consumed = [event.cloudEvent];
      const started = workflow.startScheduledInstance({
        instanceId: null,
        version,
        input: consumed,
        trigger: TriggerKind.Event,
        now,
      });

      if (!started.ok) continue;

      await this.instances.save(started.value);
      await this.runs.start(started.value);
    }
  }
}
