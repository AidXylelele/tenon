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
  private static readonly BATCH = 1_000;

  constructor(private readonly txHost: TransactionHost<DrizzleTx>) {}

  // PostgreSQL binds at most 65,535 parameters per statement, so rows go in batches.
  @Transactional(Propagation.Mandatory)
  async addAll(produced: readonly Event[]): Promise<void> {
    const rows = produced.map((event) => EventMapper.toRow(event));

    for (
      let start = 0;
      start < rows.length;
      start += DrizzleEventRepository.BATCH
    ) {
      const end = start + DrizzleEventRepository.BATCH;
      const batch = rows.slice(start, end);
      await this.txHost.tx
        .insert(events)
        .values(batch)
        .onConflictDoNothing({ target: [events.source, events.eventId] });
    }
  }
}
