import type { CloudEvent } from '../../../application/automation/events/ports.js';
import type { WebhookEvent } from '../../../domain/automation/webhooks/interfaces.js';

// A webhook call's event in CloudEvents' structured form.
export class WebhookEventMapper {
  static toCloudEvent(event: WebhookEvent): CloudEvent {
    const time = event.at.toISOString();
    return {
      specversion: '1.0',
      id: event.id,
      source: event.source,
      type: event.type,
      time,
      datacontenttype: 'application/json',
      data: event.data,
    };
  }
}
