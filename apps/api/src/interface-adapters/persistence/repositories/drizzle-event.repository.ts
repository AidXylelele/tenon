import { Injectable } from '@nestjs/common';
import {
  Propagation,
  Transactional,
  TransactionHost,
} from '@nestjs-cls/transactional';
import type { Event } from '../../../domain/automation/events/event.js';
import { Batches } from '../batches.js';
import type { DrizzleTx } from '../interfaces.js';
import { EventMapper } from '../mappers/event.mapper.js';
import { event as events } from '../schema/index.js';

@Injectable()
// The produced events' table, which the instance repository writes in its save. No use case
// writes events yet, so it has no port.
export class DrizzleEventRepository {
  constructor(private readonly txHost: TransactionHost<DrizzleTx>) {}

  @Transactional(Propagation.Mandatory)
  async addAll(produced: readonly Event[]): Promise<void> {
    const rows = produced.map((event) => EventMapper.toRow(event));

    for (const batch of Batches.of(rows))
      await this.txHost.tx
        .insert(events)
        .values(batch)
        .onConflictDoNothing({ target: [events.source, events.eventId] });
  }
}
