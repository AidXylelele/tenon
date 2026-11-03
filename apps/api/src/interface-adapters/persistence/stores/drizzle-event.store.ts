import { Injectable } from '@nestjs/common';
import {
  Propagation,
  Transactional,
  TransactionHost,
} from '@nestjs-cls/transactional';
import { Outbox } from '@nestjs/outbox';
import { eq } from 'drizzle-orm';
import type { EventOrigin } from '../../../application/automation/events/enums.js';
import type {
  AcceptedEvent,
  CloudEvent,
  EventStore,
} from '../../../application/automation/events/ports.js';
import type { DrizzleTx } from '../interfaces.js';
import { event as events } from '../schema/index.js';

// An accepted event is written once per source and id; its dispatch leaves through the outbox
// in the same transaction, one key for all so that listeners see them in the order accepted.
@Injectable()
export class DrizzleEventStore implements EventStore {
  static readonly TOPIC = 'event.accepted';
  private static readonly KEY = 'events';

  constructor(
    private readonly txHost: TransactionHost<DrizzleTx>,
    private readonly outbox: Outbox,
  ) {}

  @Transactional(Propagation.Required)
  async accept(
    cloudEvent: CloudEvent,
    origin: EventOrigin,
    instanceId: string | null,
  ): Promise<number | null> {
    const acceptedAt = new Date();
    // The intake's schema and the runtime made the three attributes text.
    const source = cloudEvent.source as string;
    const eventId = cloudEvent.id as string;
    const type = cloudEvent.type as string;
    const [accepted] = await this.txHost.tx
      .insert(events)
      .values({
        source,
        eventId,
        type,
        origin,
        instanceId,
        cloudEvent,
        acceptedAt,
      })
      .onConflictDoNothing({ target: [events.source, events.eventId] })
      .returning({ sequence: events.sequence });

    if (accepted === undefined) return null;

    const sequence = accepted.sequence;
    await this.outbox.add(this.txHost.tx, [
      {
        topic: DrizzleEventStore.TOPIC,
        key: DrizzleEventStore.KEY,
        payload: { sequence },
      },
    ]);
    return sequence;
  }

  async find(sequence: number): Promise<AcceptedEvent | null> {
    const [row] = await this.txHost.tx
      .select()
      .from(events)
      .where(eq(events.sequence, sequence));

    if (!row) return null;

    return {
      sequence: row.sequence,
      cloudEvent: row.cloudEvent,
      origin: row.origin,
      instanceId: row.instanceId,
      acceptedAt: row.acceptedAt,
    };
  }
}
