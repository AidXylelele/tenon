import { Injectable } from '@nestjs/common';
import type { AcceptedEventMessage } from './interfaces.js';
import { DispatchEvent } from '../../application/automation/events/dispatch-event.js';

@Injectable()
export class EventDispatchController {
  constructor(private readonly dispatchEvent: DispatchEvent) {}

  handle(message: AcceptedEventMessage): Promise<void> {
    return this.dispatchEvent.execute({ sequence: message.sequence });
  }
}
