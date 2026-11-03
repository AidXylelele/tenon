import { Injectable } from '@nestjs/common';
import { DispatchEvent } from '../../application/automation/events/dispatch-event.js';

export interface AcceptedEventMessage {
  readonly sequence: number;
}

@Injectable()
export class EventDispatchController {
  constructor(private readonly dispatchEvent: DispatchEvent) {}

  handle(message: AcceptedEventMessage): Promise<void> {
    return this.dispatchEvent.execute({ sequence: message.sequence });
  }
}
