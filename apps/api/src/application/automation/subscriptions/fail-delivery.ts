import { Injectable } from '@nestjs/common';
import { Clock } from '../ports.js';
import { type DeliveryCommand, DeliveryLog } from './ports.js';

// A delivery still refused after about 24 hours is failed, and kept for inspection (US6 AS3).
@Injectable()
export class FailDelivery {
  constructor(
    private readonly log: DeliveryLog,
    private readonly clock: Clock,
  ) {}

  async execute(command: DeliveryCommand): Promise<void> {
    const now = this.clock.now();
    await this.log.failed(command, now);
  }
}
