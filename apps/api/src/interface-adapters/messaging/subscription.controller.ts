import { Injectable } from '@nestjs/common';
import { MatchSubscriptions } from '../../application/automation/subscriptions/match-subscriptions.js';
import type { AcceptedEventMessage } from './event-dispatch.controller.js';

@Injectable()
export class SubscriptionController {
  constructor(private readonly matchSubscriptions: MatchSubscriptions) {}

  accepted(message: AcceptedEventMessage): Promise<void> {
    return this.matchSubscriptions.execute({ sequence: message.sequence });
  }
}
