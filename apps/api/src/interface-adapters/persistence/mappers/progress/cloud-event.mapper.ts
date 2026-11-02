import { CloudEvent } from '../../../../domain/automation/language/cloud-event.js';
import type { CloudEventState } from '../../interfaces.js';

export class CloudEventMapper {
  static toState(event: CloudEvent | null): CloudEventState | null {
    if (event === null) return null;

    const time = event.time?.toISOString() ?? null;
    return {
      id: event.id,
      source: event.source,
      type: event.type,
      time,
      subject: event.subject,
      dataContentType: event.dataContentType,
      dataSchema: event.dataSchema,
      data: event.data,
      extensions: event.extensions,
    };
  }

  static toDomain(state: CloudEventState | null): CloudEvent | null {
    if (state === null) return null;

    const time = state.time === null ? null : new Date(state.time);
    return new CloudEvent({
      id: state.id,
      source: state.source,
      type: state.type,
      time,
      subject: state.subject,
      dataContentType: state.dataContentType,
      dataSchema: state.dataSchema,
      data: state.data,
      extensions: state.extensions,
    });
  }
}
