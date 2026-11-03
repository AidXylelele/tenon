import { Injectable } from '@nestjs/common';
import type { AcceptedEvent } from '../../../application/automation/events/ports.js';
import type { EventTriggers } from '../../../application/automation/schedules/ports.js';
import type { WorkflowVersion } from '../../../domain/automation/workflows/workflow-version.js';
import { TriggerClient } from '../interfaces.js';

@Injectable()
export class EventTriggersGateway implements EventTriggers {
  constructor(private readonly client: TriggerClient) {}

  accepts(version: WorkflowVersion, event: AcceptedEvent): Promise<boolean> {
    return this.client.accepts(version.document, event.cloudEvent);
  }
}
