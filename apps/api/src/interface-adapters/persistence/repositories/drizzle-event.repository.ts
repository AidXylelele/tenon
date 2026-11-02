import { Injectable } from '@nestjs/common';
import {
  Propagation,
  Transactional,
  TransactionHost,
} from '@nestjs-cls/transactional';
import type { EventRepository } from '../../../application/automation/events/ports.js';
import type { Event } from '../../../domain/automation/events/event.js';
import type { DrizzleTx } from '../interfaces.js';
import { EventMapper } from '../mappers/event.mapper.js';
import { event as events } from '../schema/index.js';

@Injectable()
export class DrizzleEventRepository implements EventRepository {
  constructor(private readonly txHost: TransactionHost<DrizzleTx>) {}

  @Transactional(Propagation.Mandatory)
  async addAll(produced: readonly Event[]): Promise<void> {
    if (produced.length === 0) return;

    const rows = produced.map((event) => EventMapper.toRow(event));
    await this.txHost.tx
      .insert(events)
      .values(rows)
      .onConflictDoNothing({ target: [events.source, events.eventId] });
  }
}
