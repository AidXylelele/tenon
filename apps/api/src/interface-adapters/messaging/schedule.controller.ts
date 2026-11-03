import { Injectable } from '@nestjs/common';
import { StartOnEvent } from '../../application/automation/schedules/start-on-event.js';
import { SyncSchedule } from '../../application/automation/schedules/sync-schedule.js';
import type { AcceptedEventMessage } from './event-dispatch.controller.js';

export interface ScheduleChangedMessage {
  readonly workflowId: string;
}

@Injectable()
export class ScheduleController {
  constructor(
    private readonly syncSchedule: SyncSchedule,
    private readonly startOnEvent: StartOnEvent,
  ) {}

  changed(message: ScheduleChangedMessage): Promise<void> {
    return this.syncSchedule.execute({ workflowId: message.workflowId });
  }

  accepted(message: AcceptedEventMessage): Promise<void> {
    return this.startOnEvent.execute({ sequence: message.sequence });
  }
}
