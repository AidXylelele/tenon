import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { and, asc, eq, gt } from 'drizzle-orm';
import type {
  EventPage,
  EventQueries,
} from '../../../application/automation/events/queries.js';
import type { DrizzleTx } from '../interfaces.js';
import { KeysetPage } from '../keyset-page.js';
import {
  event as events,
  workflowInstance as instances,
} from '../schema/index.js';

@Injectable()
export class DrizzleEventQueries implements EventQueries {
  constructor(private readonly txHost: TransactionHost<DrizzleTx>) {}

  async ofInstance(
    instanceId: string,
    after: number | null,
    limit: number,
  ): Promise<EventPage | null> {
    const [found] = await this.txHost.tx
      .select({ id: instances.id })
      .from(instances)
      .where(eq(instances.id, instanceId));

    if (!found) return null;

    const later = after === null ? undefined : gt(events.sequence, after);
    const fetched = limit + 1;
    const rows = await this.txHost.tx
      .select({ sequence: events.sequence, cloudEvent: events.cloudEvent })
      .from(events)
      .where(and(eq(events.instanceId, instanceId), later))
      .orderBy(asc(events.sequence))
      .limit(fetched);
    const page = KeysetPage.of(rows, limit, (last) => last.sequence);
    const items = page.items.map((row) => row.cloudEvent);
    return { items, next: page.next };
  }
}
