import type { Event } from '../../../domain/automation/events/event.js';
import type { EventRow } from '../interfaces.js';

export class EventMapper {
  static toRow(event: Event): EventRow {
    return {
      id: event.id,
      source: event.source,
      eventId: event.eventId,
      type: event.type,
      time: event.time,
      subject: event.subject,
      dataContentType: event.dataContentType,
      dataSchema: event.dataSchema,
      data: event.data,
      extensions: event.extensions,
      originKind: event.origin.kind,
      originWorkflowId: event.origin.workflowId,
      originInstanceId: event.origin.instanceId,
      sequence: event.sequence,
      acceptedAt: event.acceptedAt,
    };
  }
}
