import { Injectable } from '@nestjs/common';
import type { AcceptedEvent } from '../../application/automation/events/ports.js';
import type { EventSender } from '../../application/automation/subscriptions/ports.js';
import type { DeliveryEndpoint } from '../../domain/automation/subscriptions/interfaces.js';
import { DeliveryClient } from './interfaces.js';

@Injectable()
export class EventSenderGateway implements EventSender {
  constructor(private readonly client: DeliveryClient) {}

  send(
    endpoint: DeliveryEndpoint,
    credential: string | null,
    event: AcceptedEvent,
  ): Promise<string | null> {
    return this.client.post(
      endpoint.uri,
      endpoint.scheme,
      credential,
      event.cloudEvent,
    );
  }
}
