import { Injectable } from '@nestjs/common';
import { OnOutboxMessage } from '@nestjs/outbox';
import type { ActivationChanged } from '../../domain/interfaces.js';
import { DrizzleWorkflowRepository } from '../persistence/repositories/drizzle-workflow.repository.js';
import { ScheduleRegistrar } from './schedule-registrar.js';

@Injectable()
export class ActivationHandler {
  constructor(private readonly registrar: ScheduleRegistrar) {}

  @OnOutboxMessage(DrizzleWorkflowRepository.ACTIVATION_TOPIC, {
    consumer: 'schedules',
  })
  async apply(change: ActivationChanged): Promise<void> {
    await this.registrar.sync(change.workflowId);
  }
}
